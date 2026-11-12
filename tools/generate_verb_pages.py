#!/usr/bin/env python3
"""Generate per-verb reference pages (DE + ES) from content/irregular-verbs.json
(forms, meanings, the two context sentences, quiz distractors) and
content/irregular-verbs-pages.json (page-only enrichment: translations of the
examples, extra example sentences, typical mistakes, DE/ES learner notes).

Output:
  homepage/de/unregelmaessige-verben/<slug>/index.html   (one per verb)
  homepage/es/verbos-irregulares/<slug>/index.html       (one per verb)
  homepage/de/unregelmaessige-verben/a-z/index.html      (A-Z index)
  homepage/es/verbos-irregulares/a-z/index.html          (A-Z index)
and rewrites sitemap.xml (idempotent: previous verb/a-z entries replaced)
unless run with --no-sitemap.

Slugs are IDENTICAL across languages on purpose: the language toggle's
fallback translates the topic slug and keeps the page slug as-is
(lib/krabsy-lang-switch.js), so /de/unregelmaessige-verben/go/ <->
/es/verbos-irregulares/go/ works without registering 155 pages in
topics.json.

Run from repo root:  python3 tools/generate_verb_pages.py [--no-sitemap]
"""
import json, re, hashlib, html, pathlib, sys, difflib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
LASTMOD = "2026-11-12"
CSSV = "2026-05-24"

DE_TOPIC = "unregelmaessige-verben"
ES_TOPIC = "verbos-irregulares"

# ── aggregate the question items into one record per verb ──────────────────
items = json.loads((ROOT / "content" / "irregular-verbs.json").read_text(encoding="utf-8"))
verbs = {}
for it in items:
    v = verbs.setdefault(it["verb"], {"verb": it["verb"]})
    key = "past" if it["form"] == "past" else "pp"
    v[key] = it["correct_answer"]
    v[key + "_alts"] = [a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]
    v[key + "_ctx"] = it.get("context_sentence", "")
    v[key + "_wrong"] = it.get("wrong_answers", [])[:2]
    v["meaning_de"] = it.get("meaning_de", "")
    v["meaning_es"] = it.get("meaning_es", "")
    v["tier"] = it.get("tier", 3)

VERBS = sorted(verbs.values(), key=lambda v: v["verb"])
for v in VERBS:
    v["slug"] = v["verb"].replace(" ", "-")
    base, past, pp = v["verb"], v["past"], v["pp"]
    if base == past == pp:   v["pattern"] = "AAA"
    elif past == pp:         v["pattern"] = "ABB"
    elif base == pp:         v["pattern"] = "ABA"
    else:                    v["pattern"] = "ABC"

# ── page enrichment (translations, extra examples, mistakes, notes) ─────────
PAGES = json.loads((ROOT / "content" / "irregular-verbs-pages.json").read_text(encoding="utf-8"))
_missing = [v["verb"] for v in VERBS if v["verb"] not in PAGES]
if _missing:
    sys.exit(f"content/irregular-verbs-pages.json lacks: {', '.join(_missing)}")
for v in VERBS:
    v["pg"] = PAGES[v["verb"]]

# ── other forms: 3rd person singular + -ing (rule-based, spelling-correct) ──
VOWELS = "aeiou"
# multi-syllable verbs whose stressed final syllable doubles the consonant
DOUBLE_MULTI = {"begin", "forget", "forbid", "upset", "outbid", "beset"}
def _syllables(w):
    return len(re.findall(r"[aeiouy]+", re.sub(r"e$", "", w))) or 1

def _ing_rule(w):
    """Return (ing_form, rule) for a single-word base form."""
    if w == "be": return "being", "plain"
    if w.endswith("ie"): return w[:-2] + "ying", "ie"
    if w.endswith(("ee", "ye", "oe")): return w + "ing", "ee"
    if w.endswith("e"): return w[:-1] + "ing", "e"
    q = w.replace("qu", "qw")
    cvc = (len(q) >= 3 and q[-1] not in VOWELS + "wxy" and q[-2] in VOWELS and q[-3] not in VOWELS)
    if cvc and (_syllables(w) == 1 or w in DOUBLE_MULTI):
        return w + w[-1] + "ing", "double"
    return w + "ing", "plain"

def _third(w):
    if w == "be": return "is"
    if w == "have": return "has"
    if w.endswith(("s", "x", "z", "ch", "sh", "o")): return w + "es"
    if w.endswith("y") and w[-2] not in VOWELS: return w[:-1] + "ies"
    return w + "s"

for v in VERBS:
    head_w, _, tail = v["verb"].partition(" ")
    ing, rule = _ing_rule(head_w)
    v["ing"] = (ing + " " + tail).strip()
    v["ing_rule"] = rule
    v["third"] = (_third(head_w) + " " + tail).strip()

PATTERN_TEXT = {
    "de": {
        "AAA": "A–A–A: alle drei Formen sind gleich.",
        "ABB": "A–B–B: Simple Past und Past Participle sind gleich.",
        "ABA": "A–B–A: das Past Participle ist gleich der Grundform.",
        "ABC": "A–B–C: alle drei Formen sind verschieden.",
    },
    "es": {
        "AAA": "A–A–A: las tres formas son iguales.",
        "ABB": "A–B–B: el pasado y el participio son iguales.",
        "ABA": "A–B–A: el participio es igual a la forma base.",
        "ABC": "A–B–C: las tres formas son diferentes.",
    },
}

def related(v, n=8):
    pool = [w for w in VERBS if w["pattern"] == v["pattern"] and w["slug"] != v["slug"]]
    pool.sort(key=lambda w: (abs(w["tier"] - v["tier"]), w["verb"]))
    return pool[:n]

def shuffled(options, seed):
    """Deterministic shuffle so rebuilds are reproducible."""
    return sorted(options, key=lambda o: hashlib.md5((seed + o).encode()).hexdigest())

def fill_ctx(ctx, form):
    if "___" in ctx:
        return ctx.replace("___", f"<strong>{html.escape(form)}</strong>", 1)
    return ""

E = html.escape

# ── DE title (SEO-tuned 2026-06, unchanged; see docs/seo-verb-titles-before-after.md) ──
# Title ≤60 chars: verb + key form(s) + "Simple Past & unregelmäßige Verben" +
# brand. Past participle shown only when it differs from the past. On a length
# breach: first drop "unregelmäßige Verben" (keep the higher-volume "Simple
# Past"), then drop "Simple Past" as a last resort.
def _de_forms(v):
    return v["past"] if v["past"] == v["pp"] else f"{v['past']}, {v['pp']}"

def _de_title(v):
    f = _de_forms(v)
    t1 = f"{v['verb']} – {f}: Simple Past & unregelmäßige Verben | Krabsy"
    if len(t1) <= 60: return t1
    t2 = f"{v['verb']} – {f}: Simple Past | Krabsy"
    if len(t2) <= 60: return t2
    return f"{v['verb']} – {f} | Krabsy"

# ── ES title (2026-11): front-load the observed query shapes "pasado de X",
# "pasado (simple) de X", "participio de X"; keep the forms (answer value for
# Bing Copilot). ≤60 chars where possible, shortest fallback keeps all forms.
def _past_disp(v):
    return "/".join([v["past"]] + v["past_alts"]) if v["verb"] == "be" else v["past"]

def _es_title(v):
    b, p, pp = v["verb"], _past_disp(v), v["pp"]
    if v["past"] == pp:
        cands = [f"Pasado y participio de {b} en inglés: {p} | Krabsy",
                 f"Pasado y participio de {b}: {p} | Krabsy"]
    else:
        cands = [f"Pasado de {b} en inglés: {p}, participio {pp} | Krabsy",
                 f"Pasado de {b}: {p}, participio {pp} | Krabsy",
                 f"Pasado de {b}: {p} – {pp} | Krabsy"]
    for c in cands:
        if len(c) <= 60: return c
    return cands[-1]

# ── meta descriptions (2026-11): the title already carries the forms, so the
# snippet sells what a SERP answer box can't: translated examples, the verb's
# typical mistake, quiz + games. ≤155 chars, unique per verb.
AUX = {"did", "didn't", "do", "does", "don't", "doesn't", "have", "has", "had", "haven't", "hasn't", "am", "is", "are", "was", "were", "will"}

PARTICLES = {"up"}
# which mistake makes the clearest one-line teaser in a meta description
SNIP_ORDER = ["have_past", "did_past", "regularised", "pp_as_past", "custom", "aaa_s", "third_person"]

def _best_mistake(v):
    return min(v["pg"]["mistakes"], key=lambda m: SNIP_ORDER.index(m["kind"]))

def _short_meaning(m):
    return re.sub(r"\s*\([^)]*\)", "", m).strip()

def _snip(m):
    """Shortest 'wrong' / 'right' fragments of a mistake (+ up to 2 words of context)."""
    w = m["wrong"].rstrip(".?!").split(); r = m["right"].rstrip(".?!").split()
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=w, b=r, autojunk=False).get_opcodes():
        if op != "equal":
            # context: back to a nearby auxiliary (did/have/…) if there is one
            # (present-tense kinds need their subject to make sense)
            s = i1 if m["kind"] not in ("aaa_s", "third_person", "custom") else max(0, i1 - 1)
            for k in range(i1 - 1, max(-1, i1 - 4), -1):
                if w[k].lower() in AUX: s = k; break
            e1, e2 = max(i2, i1 + 1), max(j2, j1 + 1)
            if e1 < len(w) and w[e1] in PARTICLES: e1 += 1          # wake … up
            if e2 < len(r) and r[e2] in PARTICLES: e2 += 1
            return " ".join(w[s:e1]), " ".join(r[s:e2])
    return m["wrong"], m["right"]

def _fit(cands, limit=155):
    for c in cands:
        if len(c) <= limit: return c
    return cands[-1]

def _de_desc(v):
    ws, rs = _snip(_best_mistake(v)); b, m = v["verb"], _short_meaning(v["meaning_de"])
    return _fit([
        f"{b} ({m}): Beispielsätze mit Übersetzung und typischer Fehler „{ws}“ statt „{rs}“. Mit Mini-Quiz und Spielen üben.",
        f"{b}: Beispielsätze mit Übersetzung und typischer Fehler „{ws}“ statt „{rs}“. Mit Mini-Quiz und Spielen üben.",
        f"{b} ({m}): Beispielsätze mit Übersetzung, typischer Fehler „{ws}“ – mit Mini-Quiz und Spielen üben.",
        f"{b}: Beispielsätze mit Übersetzung, typischer Fehler „{ws}“ – mit Mini-Quiz und Spielen üben.",
        f"{b}: Beispielsätze mit Übersetzung, typische Fehler, Mini-Quiz und Spiele.",
    ])

def _es_desc(v):
    ws, rs = _snip(_best_mistake(v)); b, m = v["verb"], _short_meaning(v["meaning_es"])
    return _fit([
        f"Pasado de {b} ({m}): frases traducidas al español y el error típico «{ws}» en vez de «{rs}». Con mini-quiz y juegos.",
        f"Pasado de {b}: frases traducidas al español y el error típico «{ws}» en vez de «{rs}». Con mini-quiz y juegos.",
        f"Pasado de {b} ({m}): frases traducidas, el error típico «{ws}», mini-quiz y juegos.",
        f"Pasado de {b}: frases traducidas, el error típico «{ws}», mini-quiz y juegos.",
        f"Pasado de {b}: frases de ejemplo traducidas, errores típicos, mini-quiz y juegos.",
    ])

# ── mistake explanations (auto, per kind; `custom` brings its own) ──────────
def _regular_forms(v, lang):
    if v["past"] == v["pp"]: return v["past"]
    return (f"{v['past']} (Simple Past), {v['pp']} (Past Participle)" if lang == "de"
            else f"{v['past']} (pasado) y {v['pp']} (participio)")

MISTAKE_WHY = {
    "de": {
        "did_past": lambda v, m: f"Nach did steht immer die Grundform: {v['verb']} – nicht {v['past']}.",
        "have_past": lambda v, m: f"Nach have/has/had steht das Past Participle {v['pp']} – nicht das Simple Past {v['past']}.",
        "pp_as_past": lambda v, m: f"Ohne have/has steht das Simple Past {v['past']}. {v['pp']} brauchst du nur mit have/has: I have {v['pp']}.",
        "regularised": lambda v, m: f"{v['verb']} ist unregelmäßig – „{m['form']}“ gibt es nicht. Richtig: {_regular_forms(v, 'de')}.",
        "third_person": lambda v, m: f"Im Präsens steht bei he/she/it die s-Form: {v['third']}.",
        "aaa_s": lambda v, m: f"Das Simple Past von {v['verb']} heißt auch bei he/she/it {v['past']} – ohne -s. {v['third']} ist Präsens.",
        "custom": lambda v, m: m["why_de"],
    },
    "es": {
        "did_past": lambda v, m: f"Después de did va siempre la forma base: {v['verb']}, no {v['past']}.",
        "have_past": lambda v, m: f"Después de have/has/had va el participio {v['pp']}, no el pasado {v['past']}.",
        "pp_as_past": lambda v, m: f"Sin have/has se usa el pasado {v['past']}. {v['pp']} solo va con have/has: I have {v['pp']}.",
        "regularised": lambda v, m: f"{v['verb']} es irregular: «{m['form']}» no existe. Lo correcto es {_regular_forms(v, 'es')}.",
        "third_person": lambda v, m: f"En presente, con he/she/it se usa la forma con -s: {v['third']}.",
        "aaa_s": lambda v, m: f"El pasado de {v['verb']} es {v['past']} también con he/she/it, sin -s; {v['third']} es presente.",
        "custom": lambda v, m: m["why_es"],
    },
}

ING_RULE = {
    "de": {
        "e": "das stumme e am Ende fällt weg",
        "ie": "aus -ie wird -y",
        "ee": "hier bleibt das e stehen",
        "double": "nach kurzem, betontem Vokal wird der letzte Konsonant verdoppelt",
        "plain": "einfach -ing anhängen",
    },
    "es": {
        "e": "se quita la e final",
        "ie": "la terminación -ie cambia a -y",
        "ee": "aquí la e se mantiene",
        "double": "tras vocal corta acentuada se dobla la última consonante",
        "plain": "basta con añadir -ing",
    },
}

def _alts(v, key, word):
    return f" ({word} {', '.join(v[key + '_alts'])})" if v[key + "_alts"] else ""

def _sent(s):
    return re.sub(r"\s+", " ", s).strip()

def _de_past_answer(v):
    ex = v["pg"]["ex_past"]
    en = v["past_ctx"].replace("___", v["past"])
    if v["verb"] == "be":
        head_ = "Im Simple Past heißt be was (bei I, he, she, it) bzw. were (bei you, we, they), im Present Perfect have/has been."
        tail = ""
    else:
        head_ = f"Im Simple Past heißt {v['verb']} {v['past']}{_alts(v, 'past', 'oder')}, im Present Perfect have/has {v['pp']}."
        tail = f" Fragen und Verneinungen bildest du mit did + Grundform: did … {v['verb']}?, didn't {v['verb']}."
    return _sent(f"{head_} Beispiel: „{en}“ – „{ex['de']}“{tail}")

def _es_past_answer(v):
    ex = v["pg"]["ex_past"]
    en = v["past_ctx"].replace("___", v["past"])
    if v["verb"] == "be":
        head_ = "En pasado, be se dice was (con I, he, she, it) o were (con you, we, they); con have/has se usa been."
        tail = ""
    else:
        head_ = f"En pasado, {v['verb']} se dice {v['past']}{_alts(v, 'past', 'o también')}; con have/has se usa el participio {v['pp']}."
        tail = f" En preguntas y negaciones se usa did + forma base: did … {v['verb']}?, didn't {v['verb']}."
    return _sent(f"{head_} Ejemplo: «{en}» = «{ex['es']}»{tail}")

def _faqs(lang, v):
    b, p, pp = v["verb"], v["past"], v["pp"]
    rule = ING_RULE[lang][v["ing_rule"]]
    if lang == "de":
        return [
            (f"Was ist das Simple Past von {b}?",
             f"Das Simple Past von {b} ist {_past_disp(v) if b == 'be' else p}{_alts(v, 'past', 'auch möglich:') if b != 'be' else ''}."),
            (f"Wie lautet das Partizip (Past Participle) von {b}?",
             f"Das Past Participle (Partizip Perfekt) von {b} ist {pp}{_alts(v, 'pp', 'auch möglich:')}. "
             f"Du brauchst es nach have/has/had, z. B. im Present Perfect: have {pp}."),
            (f"Was ist die Vergangenheit von {b}?", _de_past_answer(v)),
            (f"Wie schreibt man die -ing-Form von {b}?",
             f"{v['ing']} – {rule}: {b} → {v['ing']}. Bei he/she/it heißt es im Präsens {v['third']}."),
        ]
    return [
        (f"¿Cuál es el pasado de {b}?",
         f"El pasado (pasado simple) de {b} es {_past_disp(v) if b == 'be' else p}"
         f"{_alts(v, 'past', 'también:') if b != 'be' else ''}; el participio es {pp}{_alts(v, 'pp', 'también:')}."),
        (f"¿Cuál es el participio de {b}?",
         f"El participio (past participle) de {b} es {pp}{_alts(v, 'pp', 'también:')}. "
         f"Se usa después de have/has/had, por ejemplo en el present perfect: have {pp}."),
        (f"¿Cómo se dice {b} en pasado?", _es_past_answer(v)),
        (f"¿Cuál es el gerundio (forma -ing) de {b}?",
         f"{v['ing']}: {rule} ({b} → {v['ing']}). En presente, con he/she/it se usa {v['third']}."),
    ]

# ── language pack ───────────────────────────────────────────────────────────
L = {
    "de": {
        "topic": DE_TOPIC, "other": "es", "other_topic": ES_TOPIC, "locale": "de_DE",
        "topic_name": "Unregelmäßige Verben", "hub": f"/de/{DE_TOPIC}/",
        "title": _de_title,
        "desc": _de_desc,
        "h1_sub": lambda v: f"Englisch <em>{E(v['verb'])}</em> = {E(v['meaning_de'])}",
        "th": ("Grundform", "Simple Past", "Past Participle"), "also": "auch möglich:",
        "oforms": ("3. Person (he/she/it)", "-ing-Form"),
        "ex_h": "Beispielsätze mit Übersetzung", "ex_past": "Simple Past", "ex_pp": "Past Participle",
        "ex_extra": ("Frage (Simple Past)", "Verneinung (Simple Past)", "Präsens (-ing-Form)", "Präsens (he/she/it)"),
        "mx_h": "Typische Fehler", "note_h": "Gut zu wissen",
        "quiz_h": "Mini-Quiz: kannst du es?", "quiz_past": lambda v: f"Was ist das Simple Past von <b>{E(v['verb'])}</b>?",
        "quiz_pp": lambda v: f"Was ist das Past Participle von <b>{E(v['verb'])}</b>?",
        "right": "Richtig! 🎉", "wrong_fb": "Leider nein — die richtige Antwort ist",
        "pattern_h": "Muster", "rel_h": "Verben mit demselben Muster",
        "faq_h": "Häufige Fragen",
        "cta_h": "Jetzt üben", "cta_sub": "Festigen, was du gerade gelernt hast:",
        "cta": [("Sprint", "sprint"), ("Type Race", "type-race"), ("Karteikarten", "karteikarten"), ("Verb-Tabelle", "verb-tabelle")],
        "cta_games": ("Alle Spiele", "/de/spiele/"),
        "prev": "Vorheriges Verb", "next": "Nächstes Verb", "all": "Alle Verben A–Z",
        "crumb_all": "Alle Verben",
        "idx_title": "Unregelmäßige Verben Englisch – Liste von A bis Z | Krabsy",
        "idx_desc": lambda n: (f"Liste aller {n} wichtigen unregelmäßigen englischen Verben mit Simple Past, Past Participle "
                               f"und deutscher Bedeutung – jedes mit Beispielsätzen und Mini-Quiz."),
        "idx_h1": "Unregelmäßige Verben von A bis Z",
        "idx_sub": lambda n: f"{n} Verben — tippe ein Verb für alle Formen, Beispielsätze mit Übersetzung, typische Fehler und ein Mini-Quiz.",
        "idx_intro": lambda c: (
            f"<p>Unregelmäßige Verben bilden das Simple Past und das Past Participle nicht mit -ed – ihre Formen musst du lernen. "
            f"Diese Liste enthält alle {c['n']} Verben, die dir in der Schule begegnen, von {c['first']} bis {c['last']}.</p>"
            f"<p>Viele folgen einem Muster: Bei {c['AAA']} Verben sind alle drei Formen gleich (put – put – put), "
            f"bei {c['ABB']} sind Simple Past und Past Participle gleich (buy – bought – bought), "
            f"bei {c['ABA']} ist das Past Participle gleich der Grundform (come – came – come) "
            f"und bei {c['ABC']} sind alle drei verschieden (write – wrote – written).</p>"),
        "idx_top_h": "Die wichtigsten zuerst",
        "idx_top_sub": lambda n: f"Diese {n} Verben kommen am häufigsten vor – lerne sie zuerst:",
        "idx_th": ("Grundform", "Simple Past", "Past Participle", "Deutsch"),
        "footer_lang": "Sprache wählen",
    },
    "es": {
        "topic": ES_TOPIC, "other": "de", "other_topic": DE_TOPIC, "locale": "es_ES",
        "topic_name": "Verbos irregulares", "hub": f"/es/{ES_TOPIC}/",
        "title": _es_title,
        "desc": _es_desc,
        "h1_sub": lambda v: f"Inglés <em>{E(v['verb'])}</em> = {E(v['meaning_es'])}",
        "th": ("Forma base", "Pasado simple", "Participio"), "also": "también:",
        "oforms": ("3.ª persona (he/she/it)", "Gerundio (-ing)"),
        "ex_h": "Frases de ejemplo con traducción", "ex_past": "Pasado simple", "ex_pp": "Participio",
        "ex_extra": ("Pregunta (pasado simple)", "Negación (pasado simple)", "Presente continuo (-ing)", "Presente (he/she/it)"),
        "mx_h": "Errores típicos", "note_h": "Ojo",
        "quiz_h": "Mini-quiz: ¿te lo sabes?", "quiz_past": lambda v: f"¿Cuál es el pasado simple de <b>{E(v['verb'])}</b>?",
        "quiz_pp": lambda v: f"¿Cuál es el participio de <b>{E(v['verb'])}</b>?",
        "right": "¡Correcto! 🎉", "wrong_fb": "No — la respuesta correcta es",
        "pattern_h": "Patrón", "rel_h": "Verbos con el mismo patrón",
        "faq_h": "Preguntas frecuentes",
        "cta_h": "Practica ahora", "cta_sub": "Refuerza lo que acabas de aprender:",
        "cta": [("Sprint", "sprint"), ("Type Race", "type-race"), ("Tarjetas", "tarjetas"), ("Tabla de verbos", "tabla-de-verbos")],
        "cta_games": ("Todos los juegos", "/es/juegos/"),
        "prev": "Verbo anterior", "next": "Verbo siguiente", "all": "Todos los verbos A–Z",
        "crumb_all": "Todos los verbos",
        "idx_title": "Lista de verbos irregulares en inglés de la A a la Z | Krabsy",
        "idx_desc": lambda n: (f"Lista de los {n} verbos irregulares más importantes del inglés con pasado simple, participio "
                               f"y traducción – cada uno con frases de ejemplo y mini-quiz."),
        "idx_h1": "Verbos irregulares de la A a la Z",
        "idx_sub": lambda n: f"{n} verbos — toca un verbo para ver todas sus formas, frases de ejemplo traducidas, errores típicos y un mini-quiz.",
        "idx_intro": lambda c: (
            f"<p>Los verbos irregulares no forman el pasado simple ni el participio con -ed, así que hay que aprender sus formas. "
            f"Esta lista reúne los {c['n']} verbos que te vas a encontrar en clase de inglés, de {c['first']} a {c['last']}.</p>"
            f"<p>Muchos siguen un patrón: en {c['AAA']} verbos las tres formas son iguales (put – put – put), "
            f"en {c['ABB']} el pasado y el participio coinciden (buy – bought – bought), "
            f"en {c['ABA']} el participio es igual a la forma base (come – came – come) "
            f"y en {c['ABC']} las tres formas son distintas (write – wrote – written).</p>"),
        "idx_top_h": "Los más importantes primero",
        "idx_top_sub": lambda n: f"Estos {n} verbos son los más frecuentes: apréndelos primero.",
        "idx_th": ("Forma base", "Pasado simple", "Participio", "Significado"),
        "footer_lang": "Elegir idioma",
    },
}

STYLE = """
    body { background: var(--krabsy-cream); }
    .logo{display:inline-flex;align-items:center;gap:0;font-family:var(--font-display);font-size:1.6rem;text-decoration:none;color:var(--krabsy-ink);letter-spacing:-0.5px;line-height:1}
    .logo-crab{display:inline-flex;width:1.15em;height:1.15em;align-items:center;justify-content:center;margin:0 -0.04em;vertical-align:middle}
    .logo-crab img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
    .vp-wrap{max-width:760px;margin:0 auto;padding:0 var(--space-5) var(--space-7);width:100%}
    .crumbs{font-size:0.82rem;color:var(--krabsy-ink-mute);padding:var(--space-4) 0 0}
    .crumbs a{color:inherit;text-decoration:none}
    .crumbs a:hover{text-decoration:underline}
    .vp-h1{font-family:var(--font-display);font-size:clamp(1.7rem,5.4vw,2.5rem);color:var(--krabsy-ink);margin:10px 0 4px;line-height:1.15}
    .vp-sub{color:var(--krabsy-ink-mute);font-size:1rem;margin-bottom:18px}
    .vp-card{background:#fff;border:1px solid rgba(31,43,61,0.08);border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 10px rgba(31,43,61,0.04)}
    .vp-card h2{font-family:var(--font-display);font-size:1.05rem;color:var(--krabsy-ink);margin-bottom:10px}
    table.vforms{width:100%;border-collapse:collapse;font-size:1.05rem}
    .vforms th{font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:var(--krabsy-ink-mute);text-align:left;padding:4px 10px}
    .vforms td{padding:8px 10px;font-family:var(--font-display);font-size:1.25rem;border-radius:10px}
    .vforms .f-base{color:#b8860b}.vforms .f-past{color:#0d9c7c}.vforms .f-pp{color:#e05252}
    .valts{font-size:0.82rem;color:var(--krabsy-ink-mute);margin-top:6px}
    .vp-ex{margin:0;padding:0;list-style:none}
    .vp-ex li{padding:9px 12px;border-left:3px solid var(--krabsy-teal,#2ec4a0);background:#f6faf8;border-radius:0 10px 10px 0;margin-bottom:8px;font-size:0.98rem;color:var(--krabsy-ink)}
    .vp-ex li.pp{border-left-color:#e05252;background:#fdf4f2}
    .vp-ex .lbl{display:block;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--krabsy-ink-mute);margin-bottom:2px}
    .quiz-q{margin-bottom:14px}
    .quiz-q p{font-size:0.98rem;color:var(--krabsy-ink);margin-bottom:8px}
    .quiz-opts{display:flex;gap:8px;flex-wrap:wrap}
    .quiz-btn{font-family:var(--font-display);font-size:1rem;padding:8px 20px;border-radius:30px;border:2px solid rgba(31,43,61,0.15);background:#fff;cursor:pointer;transition:transform .12s}
    .quiz-btn:hover{transform:translateY(-1px)}
    .quiz-btn.ok{background:#d9f4ec;border-color:#0d9c7c;color:#0d6e58}
    .quiz-btn.no{background:#fde3e3;border-color:#e05252;color:#a33}
    .quiz-fb{font-size:0.88rem;margin-top:6px;min-height:1.2em;font-weight:700}
    .quiz-fb.ok{color:#0d9c7c}.quiz-fb.no{color:#e05252}
    .vp-pattern{font-size:0.95rem;color:var(--krabsy-ink)}
    .rel-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
    .rel-list a{font-family:var(--font-display);font-size:0.9rem;color:var(--krabsy-ink);background:#fff;border:1.5px solid rgba(31,43,61,0.14);padding:5px 14px;border-radius:30px;text-decoration:none;transition:transform .12s}
    .rel-list a:hover{transform:translateY(-1px);border-color:var(--krabsy-teal,#2ec4a0)}
    .faq dt{font-weight:800;color:var(--krabsy-ink);margin-top:10px;font-size:0.95rem}
    .faq dd{color:var(--krabsy-ink-mute);font-size:0.93rem;margin:2px 0 0}
    .cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .cta-row a{font-family:var(--font-display);font-size:0.92rem;color:#fff;background:linear-gradient(135deg,#2ec4a0,#0d9c7c);padding:8px 18px;border-radius:30px;text-decoration:none;box-shadow:0 3px 10px rgba(0,196,154,0.25)}
    .cta-row a.alt{background:linear-gradient(135deg,#ff8a70,#e05252);box-shadow:0 3px 10px rgba(224,82,82,0.22)}
    .vp-nav{display:flex;justify-content:space-between;gap:10px;font-size:0.9rem;margin:18px 0 0}
    .vp-nav a{color:var(--krabsy-ink);text-decoration:none;font-weight:800}
    .vp-nav a:hover{text-decoration:underline}
    .az-letter{font-family:var(--font-display);font-size:1.3rem;color:var(--krabsy-ink);margin:18px 0 8px}
    .az-grid{display:flex;gap:8px;flex-wrap:wrap}
    .az-grid a{font-family:var(--font-display);font-size:0.95rem;color:var(--krabsy-ink);background:#fff;border:1.5px solid rgba(31,43,61,0.14);padding:6px 16px;border-radius:30px;text-decoration:none;transition:transform .12s}
    .az-grid a:hover{transform:translateY(-1px);border-color:var(--krabsy-teal,#2ec4a0)}
    .oforms{display:flex;gap:6px 20px;flex-wrap:wrap;margin-top:10px;font-size:0.88rem;color:var(--krabsy-ink-mute)}
    .oforms b{font-family:var(--font-display);font-weight:400;font-size:1.05rem;color:var(--krabsy-ink)}
    .vp-ex .tr{display:block;font-size:0.88rem;color:var(--krabsy-ink-mute);margin-top:3px}
    .vp-ex li.q{border-left-color:#f0b429;background:#fffaf0}
    .mx{padding:8px 0 10px;border-bottom:1px dashed rgba(31,43,61,0.12);margin-bottom:8px}
    .mx p{margin:0;font-size:0.98rem}
    .mx-w{color:#a33}.mx-w b{text-decoration:line-through;text-decoration-thickness:2px}
    .mx-r{color:#0d6e58;margin-top:2px}.mx-r b{background:#d9f4ec;border-radius:4px;padding:0 3px}
    .mx-why{font-size:0.88rem;color:var(--krabsy-ink-mute);margin-top:4px}
    .vp-note{background:#fff8e6;border:1px solid #f5d98a;border-radius:12px;padding:10px 14px;font-size:0.93rem;color:var(--krabsy-ink);margin-top:10px}
    .az-intro p{font-size:0.95rem;color:var(--krabsy-ink);margin:0 0 8px}
    .az-note{font-size:0.9rem;color:var(--krabsy-ink-mute);margin-bottom:8px}
    .az-jump{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
    .az-jump a{font-family:var(--font-display);color:var(--krabsy-ink);text-decoration:none;padding:2px 8px;border-radius:8px;background:#fff;border:1px solid rgba(31,43,61,0.12)}
    table.az{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:0.95rem}
    .az th{font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:var(--krabsy-ink-mute);text-align:left;padding:6px 8px}
    .az td{padding:6px 8px;border-top:1px solid rgba(31,43,61,0.07);color:var(--krabsy-ink)}
    .az td a{font-family:var(--font-display);color:var(--krabsy-ink);text-decoration:none}
    .az td a:hover{text-decoration:underline}
    .az td.m{color:var(--krabsy-ink-mute);font-size:0.85rem}
"""

QUIZ_JS = """
function vq(btn, ok, fbId, correct, okTxt, noTxt) {
  var box = btn.parentNode;
  var fb = document.getElementById(fbId);
  Array.prototype.forEach.call(box.children, function (b) { b.disabled = true; });
  if (ok) { btn.classList.add('ok'); fb.textContent = okTxt; fb.className = 'quiz-fb ok'; }
  else { btn.classList.add('no'); fb.textContent = noTxt + ' "' + correct + '".'; fb.className = 'quiz-fb no'; }
}
"""

def head(lang, t, title, desc, path, other_path):
    other = t["other"]
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","{lang}");}}catch(_){{}}</script>
  <title>{E(title)}</title>
  <meta name="description" content="{E(desc)}">
  <link rel="canonical" href="https://krabsy.com{path}">
  <link rel="alternate" hreflang="{lang}" href="https://krabsy.com{path}">
  <link rel="alternate" hreflang="{other}" href="https://krabsy.com{other_path}">
  <link rel="alternate" hreflang="x-default" href="https://krabsy.com{path if lang == 'de' else other_path}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
  <meta property="og:title" content="{E(title)}">
  <meta property="og:description" content="{E(desc)}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="https://krabsy.com{path}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Krabsy">
  <meta property="og:locale" content="{t['locale']}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{E(title)}">
  <meta name="twitter:description" content="{E(desc)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v={CSSV}">
  <style>{STYLE}</style>
</head>"""

def chrome_open(lang, t):
    return f"""<body>
  <div class="k-page">
    <header class="k-page-header">
      <a href="/{lang}/" class="logo" aria-label="Krabsy">
        <span>kr</span>
        <span class="logo-crab" aria-hidden="true"><img src="/favicon.png" alt="" decoding="async"></span>
        <span>bsy</span>
      </a>
      <div class="k-lang-toggle" role="group" aria-label="{t['footer_lang']}">
        <button class="k-lang-btn{' is-active' if lang == 'de' else ''}" type="button" data-lang="de">DE</button>
        <button class="k-lang-btn{' is-active' if lang == 'es' else ''}" type="button" data-lang="es">ES</button>
      </div>
    </header>
    <div class="vp-wrap">"""

def chrome_close():
    return f"""    </div>
    <footer class="k-footer">
      <span id="footer-copyright">© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v={CSSV}" defer></script>
  <script src="/lib/krabsy-topic-nav.js?v={CSSV}" defer></script>
  <script src="/lib/krabsy-lang-switch.js?v={CSSV}" defer></script>
  <script src="/lib/krabsy-analytics.js?v={CSSV}" defer></script>
</body>
</html>"""

def quiz_block(t, v, form_key, idx):
    correct = v[form_key]
    opts = shuffled([correct] + v[form_key + "_wrong"], v["verb"] + form_key)
    q = t["quiz_past"](v) if form_key == "past" else t["quiz_pp"](v)
    fb = f"qfb{idx}"
    btns = "".join(
        f"""<button class="quiz-btn" onclick="vq(this,{str(o == correct).lower()},'{fb}','{E(correct)}','{E(t['right'])}','{E(t['wrong_fb'])}')">{E(o)}</button>"""
        for o in opts)
    return f"""<div class="quiz-q"><p>{q}</p><div class="quiz-opts">{btns}</div><div class="quiz-fb" id="{fb}"></div></div>"""

def _words_re(words):
    words = sorted({w for w in words if w}, key=len, reverse=True)
    return re.compile(r"(?<![A-Za-z'])(" + "|".join(re.escape(w) for w in words) + r")(?![A-Za-z])", re.I)

def mark(sentence, words):
    """Escape a sentence and bold the given verb forms (whole words only)."""
    rx = _words_re(words)
    out, pos = [], 0
    for m in rx.finditer(sentence):
        out.append(E(sentence[pos:m.start()])); out.append(f"<strong>{E(m.group(0))}</strong>"); pos = m.end()
    out.append(E(sentence[pos:]))
    return "".join(out)

def diff_mark(a, b):
    """Escape sentence a, wrapping the words that differ from sentence b in <b>."""
    wa, wb = a.split(" "), b.split(" ")
    out = []
    for op, i1, i2, _, _ in difflib.SequenceMatcher(a=wa, b=wb, autojunk=False).get_opcodes():
        chunk = E(" ".join(wa[i1:i2]))
        if chunk:
            out.append(chunk if op == "equal" else f"<b>{chunk}</b>")
    return " ".join(out)

def _verb_words(v):
    """All single-word forms of the verb (for bolding in example sentences)."""
    forms = [v["verb"], v["past"], v["pp"], v["ing"], v["third"], *v["past_alts"], *v["pp_alts"]]
    if v["verb"] == "be": forms += ["am", "is", "are", "was", "were", "wasn't", "weren't"]
    out = set()
    for f in forms:
        out.add(f)
    return out

def verb_page(lang, v, prev_v, next_v):
    t = L[lang]
    pg = v["pg"]
    path = f"/{lang}/{t['topic']}/{v['slug']}/"
    other_path = f"/{t['other']}/{t['other_topic']}/{v['slug']}/"
    title, desc = t["title"](v), t["desc"](v)
    vw = _verb_words(v)

    # examples: the two catalogue sentences + 3 authored ones, each translated
    ex = []
    for key, cls, lbl in (("past", "", t["ex_past"]), ("pp", "pp", t["ex_pp"])):
        ctx = v.get(key + "_ctx", "")
        if "___" not in ctx: continue
        en = fill_ctx(ctx, v[key])
        tr = pg["ex_" + key][lang]
        ex.append(f'<li class="{cls}"><span class="lbl">{lbl}</span>{en}<span class="tr">{E(tr)}</span></li>')
    for i, e in enumerate(pg["extra"]):
        if i < 2:
            lbl = t["ex_extra"][i]
        else:
            lbl = t["ex_extra"][2] if _words_re([v["ing"]]).search(e["en"]) else t["ex_extra"][3]
        ex.append(f'<li class="q"><span class="lbl">{lbl}</span>{mark(e["en"], vw)}<span class="tr">{E(e[lang])}</span></li>')
    ex_html = f"""<section class="vp-card"><h2>{t['ex_h']}</h2><ul class="vp-ex">{''.join(ex)}</ul></section>"""

    # typical mistakes + optional learner note (language-specific)
    mx = []
    for m in pg["mistakes"]:
        why = MISTAKE_WHY[lang][m["kind"]](v, m)
        mx.append(f"""<div class="mx"><p class="mx-w"><span aria-hidden="true">✗</span> {diff_mark(m['wrong'], m['right'])}</p>"""
                  f"""<p class="mx-r"><span aria-hidden="true">✓</span> {diff_mark(m['right'], m['wrong'])}</p>"""
                  f"""<p class="mx-why">{E(why)}</p></div>""")
    note = pg.get("note_" + lang, "")
    note_html = f'<div class="vp-note"><strong>{t["note_h"]}:</strong> {E(note)}</div>' if note else ""
    mx_html = f"""<section class="vp-card"><h2>{t['mx_h']}</h2>{''.join(mx)}{note_html}</section>"""

    alts = []
    if v["past_alts"]: alts.append(f"{t['th'][1]} {t['also']} {E(', '.join(v['past_alts']))}")
    if v["pp_alts"]: alts.append(f"{t['th'][2]} {t['also']} {E(', '.join(v['pp_alts']))}")
    alts_html = f'<div class="valts">{" · ".join(alts)}</div>' if alts else ""
    oforms_html = (f'<div class="oforms"><span>{t["oforms"][0]}: <b>{E(v["third"])}</b></span>'
                   f'<span>{t["oforms"][1]}: <b>{E(v["ing"])}</b></span></div>')

    rel = related(v)
    rel_html = "".join(f'<a href="/{lang}/{t["topic"]}/{w["slug"]}/">{E(w["verb"])} – {E(w["past"])} – {E(w["pp"])}</a>' for w in rel)

    cta = "".join(f'<a href="{t["hub"]}{slug}/">{E(name)}</a>' for name, slug in t["cta"])
    cta += f'<a class="alt" href="{t["cta_games"][1]}">{E(t["cta_games"][0])} →</a>'

    nav = []
    nav.append(f'<a href="/{lang}/{t["topic"]}/{prev_v["slug"]}/">← {E(prev_v["verb"])}</a>' if prev_v else "<span></span>")
    nav.append(f'<a href="/{lang}/{t["topic"]}/a-z/">{t["all"]}</a>')
    nav.append(f'<a href="/{lang}/{t["topic"]}/{next_v["slug"]}/">{E(next_v["verb"])} →</a>' if next_v else "<span></span>")

    faqs = _faqs(lang, v)
    faq_ld = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs],
    }
    faq_html = "".join(f"<dt>{E(q)}</dt><dd>{E(a)}</dd>" for q, a in faqs)
    crumb_ld = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": t["topic_name"], "item": f"https://krabsy.com{t['hub']}"},
            {"@type": "ListItem", "position": 2, "name": t["crumb_all"], "item": f"https://krabsy.com/{lang}/{t['topic']}/a-z/"},
            {"@type": "ListItem", "position": 3, "name": v["verb"], "item": f"https://krabsy.com{path}"},
        ],
    }

    return head(lang, t, title, desc, path, other_path) + chrome_open(lang, t) + f"""
      <nav class="crumbs"><a href="{t['hub']}">{t['topic_name']}</a> › <a href="/{lang}/{t['topic']}/a-z/">{t['crumb_all']}</a> › {E(v['verb'])}</nav>
      <h1 class="vp-h1">{E(v['verb'])} – {E(v['past'])} – {E(v['pp'])}</h1>
      <p class="vp-sub">{t['h1_sub'](v)}</p>

      <section class="vp-card">
        <table class="vforms">
          <tr><th>{t['th'][0]}</th><th>{t['th'][1]}</th><th>{t['th'][2]}</th></tr>
          <tr><td class="f-base">{E(v['verb'])}</td><td class="f-past">{E(v['past'])}</td><td class="f-pp">{E(v['pp'])}</td></tr>
        </table>
        {alts_html}
        {oforms_html}
      </section>

      {ex_html}

      {mx_html}

      <section class="vp-card">
        <h2>{t['quiz_h']}</h2>
        {quiz_block(t, v, 'past', 1)}
        {quiz_block(t, v, 'pp', 2)}
      </section>

      <section class="vp-card">
        <h2>{t['pattern_h']}</h2>
        <p class="vp-pattern">{PATTERN_TEXT[lang][v['pattern']]}</p>
        <h2 style="margin-top:14px">{t['rel_h']}</h2>
        <div class="rel-list">{rel_html}</div>
      </section>

      <section class="vp-card faq">
        <h2>{t['faq_h']}</h2>
        <dl>{faq_html}</dl>
      </section>

      <section class="vp-card">
        <h2>{t['cta_h']}</h2>
        <p style="font-size:0.9rem;color:var(--krabsy-ink-mute)">{t['cta_sub']}</p>
        <div class="cta-row">{cta}</div>
      </section>

      <nav class="vp-nav">{''.join(nav)}</nav>
  <script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>
  <script type="application/ld+json">{json.dumps(crumb_ld, ensure_ascii=False)}</script>
  <script>{QUIZ_JS}</script>
""" + chrome_close()

def index_page(lang):
    t = L[lang]
    path = f"/{lang}/{t['topic']}/a-z/"
    other_path = f"/{t['other']}/{t['other_topic']}/a-z/"
    n = len(VERBS)
    counts = {"n": n, "first": VERBS[0]["verb"], "last": VERBS[-1]["verb"]}
    for pat in ("AAA", "ABB", "ABA", "ABC"):
        counts[pat] = sum(1 for v in VERBS if v["pattern"] == pat)
    href = lambda v: f'/{lang}/{t["topic"]}/{v["slug"]}/'
    top = [v for v in VERBS if v["tier"] == 1]
    top_html = "".join(f'<a href="{href(v)}">{E(v["verb"])}</a>' for v in top)
    groups = {}
    for v in VERBS:
        groups.setdefault(v["verb"][0].upper(), []).append(v)
    jump = " ".join(f'<a href="#az-{l.lower()}">{l}</a>' for l in sorted(groups))
    th = "".join(f"<th>{h}</th>" for h in t["idx_th"])
    body = ""
    for letter in sorted(groups):
        rows = "".join(
            f'<tr><td><a href="{href(v)}">{E(v["verb"])}</a></td><td>{E(v["past"])}</td><td>{E(v["pp"])}</td>'
            f'<td class="m">{E(v["meaning_" + lang])}</td></tr>' for v in groups[letter])
        body += (f'<h2 class="az-letter" id="az-{letter.lower()}">{letter}</h2>'
                 f'<table class="az"><thead><tr>{th}</tr></thead><tbody>{rows}</tbody></table>')
    return head(lang, t, t["idx_title"], t["idx_desc"](n), path, other_path) + chrome_open(lang, t) + f"""
      <nav class="crumbs"><a href="{t['hub']}">{t['topic_name']}</a> › {t['crumb_all']}</nav>
      <h1 class="vp-h1">{t['idx_h1']}</h1>
      <p class="vp-sub">{t['idx_sub'](n)}</p>
      <section class="vp-card az-intro">{t['idx_intro'](counts)}</section>
      <section class="vp-card">
        <h2>{t['idx_top_h']}</h2>
        <p class="az-note">{t['idx_top_sub'](len(top))}</p>
        <div class="az-grid">{top_html}</div>
      </section>
      <nav class="az-jump">{jump}</nav>
      {body}
""" + chrome_close()

# ── write pages ──────────────────────────────────────────────────────────────
written = 0
for lang in ("de", "es"):
    t = L[lang]
    for i, v in enumerate(VERBS):
        prev_v = VERBS[i - 1] if i > 0 else None
        next_v = VERBS[i + 1] if i < len(VERBS) - 1 else None
        out = HP / lang / t["topic"] / v["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(verb_page(lang, v, prev_v, next_v), encoding="utf-8")
        written += 1
    out = HP / lang / t["topic"] / "a-z" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(index_page(lang), encoding="utf-8")
    written += 1
print(f"pages written: {written}")

if "--no-sitemap" in sys.argv:
    print("sitemap.xml left untouched (--no-sitemap)")
    sys.exit(0)

# ── sitemap (idempotent) ─────────────────────────────────────────────────────
sm = HP / "sitemap.xml"
txt = sm.read_text(encoding="utf-8")
known_slugs = {v["slug"] for v in VERBS} | {"a-z"}
blocks = re.split(r"(?=  <url>)", txt)
kept = []
for b in blocks:
    loc = re.search(r"<loc>https://krabsy\.com/(de|es)/[^/]+/([^/<]+)/</loc>", b)
    if loc and loc.group(2) in known_slugs:
        continue  # regenerated below
    kept.append(b)
txt = "".join(kept)

entries = []
def url_entry(de_path, es_path, which):
    loc = de_path if which == "de" else es_path
    return f"""  <url>
    <loc>https://krabsy.com{loc}</loc>
    <lastmod>{LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <xhtml:link rel="alternate" hreflang="de"        href="https://krabsy.com{de_path}"/>
    <xhtml:link rel="alternate" hreflang="es"        href="https://krabsy.com{es_path}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://krabsy.com{de_path}"/>
  </url>
"""
for which in ("de", "es"):
    entries.append(url_entry(f"/de/{DE_TOPIC}/a-z/", f"/es/{ES_TOPIC}/a-z/", which))
for v in VERBS:
    for which in ("de", "es"):
        entries.append(url_entry(f"/de/{DE_TOPIC}/{v['slug']}/", f"/es/{ES_TOPIC}/{v['slug']}/", which))

txt = txt.replace("</urlset>", "".join(entries) + "</urlset>")
sm.write_text(txt, encoding="utf-8")
n_urls = txt.count("<loc>")
print(f"sitemap now has {n_urls} URLs")
