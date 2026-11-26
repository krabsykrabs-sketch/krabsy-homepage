#!/usr/bin/env python3
"""Check Krabsy materials against content/materials/README.md.

    python3 tools/check_materials.py               # content/materials + served copies
    python3 tools/check_materials.py a.json b.json # only these files (runtime materials)

Exit code 1 on any error. Warnings (own sentences in grammar worksheets, quality
notes on curated worksheets) are info only.

Quality rules for gap steps (all sentences of a step are on screen together, and the
teach line of every answered sentence is shown before the next one):
  - give-away: an answer (for describing words / nouns also its -o/-a/-os/-as form) must
    not appear in the text or hint of any sentence of the same step; a teach line must
    not name another sentence's answer word (unless it is also a word of its own answer,
    which is on screen anyway once filled in) or contain another sentence filled in. Verb forms (soy, está, tengo …) count only as the exact word.
  - variety: the same answer at most twice in a row and for at most ~40 % of the step.
  - drag bank: no word twice, at least 2 wrong extras.
  - duplicates: the same sentence text twice in one material, or in two topic files
    with different answers.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'content'
SERVED = ROOT / 'homepage' / 'data'

KINDS = {'worksheet', 'book', 'cards'}
LEVELS = {'Pre-A1', 'A1', 'A2', 'B1'}
MODES = {'drag', 'typed', 'choice'}
STEP_TYPES = {'text', 'cards', 'tap', 'match', 'sort', 'gap'}
SCENES = {'farm', 'field', 'mud', 'barn', 'pond', 'evening'}
VOCAB_SETS = {'animals', 'feelings', 'food', 'family'}
VOCAB_TOPICS = {'es_animals', 'es_feelings', 'es_food', 'es_family'}
MAX_BYTES = 200 * 1024
# Grammar words must never be in a question (presentation mandate).
TERMS = re.compile(r'\b(verb|verbo|tense|participle|participio|infinitive|infinitivo|conjugat\w*|'
                   r'subject|adjective|adjetivo|noun|sustantivo|pronoun|pronombre|gerund|subjunctive|'
                   r'preterite|pretérito|imperfect\w*|simple past|simple present|1st person|2nd person|'
                   r'3rd person|first person|third person|singular|plural|masculine|feminine)\b', re.I)
# Spanish words not safe or not natural in Uruguay/Argentina.
REGIONAL = re.compile(r'\b(conchas?|zumos?|fresas?|enfadad[oa]s?|tartas?|coger|patatas?|melocot[oó]n)\b', re.I)
NORM = lambda s: re.sub(r'\s+', ' ', s.strip().lower())
WORDS = re.compile(r"[a-záéíóúüñ]+", re.I)
# Verb forms are what grammar steps practise: they give away only as the exact word.
VERB_FORMS = set('soy eres es somos sois son estoy estás está estamos estáis están tengo tienes '
                 'tiene tenemos tienen me llamo llamas llama hay'.split())


def stem(w):
    """Word form key: contento / contenta / contentos → content."""
    w = w.lower()
    if w in VERB_FORMS or len(w) < 5:
        return w
    for end in ('os', 'as', 'es', 'o', 'a', 's'):
        if w.endswith(end) and len(w) - len(end) >= 4:
            return w[:-len(end)]
    return w


def word_keys(text, exact=False):
    return {(w.lower() if exact else stem(w)) for w in WORDS.findall(text or '')}


def bare(text):
    """Sentence without punctuation, lower case, for 'is it inside that teach line'."""
    return ' '.join(w.lower() for w in WORDS.findall(text or ''))
TAPWORD = re.compile(r'\{([^{}]*)\}')


class Checker:
    def __init__(self):
        self.errors, self.warnings = [], []
        self.v1 = False
        self.vocab = json.loads((CONTENT / 'vocab' / 'es.json').read_text())
        self.topics = {}
        for f in SERVED.glob('es-*.json'):
            d = json.loads(f.read_text())
            if d.get('format') == 2:
                self.topics[d['id']] = {it['id']: it for it in d['items']}
        self.known_topics = set(self.topics) | {'irregular_verbs', 'prepositions'}

    def err(self, where, msg):
        self.errors.append(f'{where}: {msg}')

    def warn(self, where, msg):
        self.warnings.append(f'{where}: {msg}')

    def shown(self, where, s):
        """Text a learner sees as (part of) a question."""
        if not isinstance(s, str):
            return self.err(where, 'expected text')
        if TERMS.search(s):
            self.err(where, f'grammar term in a question: {TERMS.search(s).group(0)!r}')
        if REGIONAL.search(s):
            self.err(where, f'not safe for Uruguay/Argentina: {REGIONAL.search(s).group(0)!r}')

    def word(self, where, w):
        if w not in self.vocab:
            self.err(where, f'unknown vocab id {w!r}')

    # ── vocabulary ──
    def check_vocab(self):
        for k, e in self.vocab.items():
            w = f'vocab/es.json[{k}]'
            if not re.fullmatch(r'[a-z0-9_]+', k):
                self.err(w, 'id must be [a-z0-9_]')
            for f in ('es', 'en', 'de', 'emoji', 'set'):
                if not isinstance(e.get(f), str) or not e[f]:
                    self.err(w, f'missing {f}')
            if e.get('set') not in VOCAB_SETS:
                self.err(w, f'unknown set {e.get("set")!r}')
            extra = set(e) - {'es', 'en', 'de', 'emoji', 'set', 'f', 'img'}
            if extra:
                self.err(w, f'unknown fields {sorted(extra)}')
            self.shown(w, e.get('es', '') + ' ' + e.get('f', ''))

    # ── materials ──
    def check_material(self, m, where):
        if not isinstance(m, dict):
            return self.err(where, 'not an object')
        self.v1 = (m.get('source') or {}).get('kind') == 'v1'
        size = len(json.dumps(m, ensure_ascii=False).encode())
        if size > MAX_BYTES:
            self.err(where, f'{size} bytes > 200 KB')
        for f in ('id', 'kind', 'title', 'topic', 'level', 'learn'):
            if not isinstance(m.get(f), str) or not m[f]:
                self.err(where, f'missing {f}')
        if not re.fullmatch(r'[a-z0-9_]+', m.get('id', '')):
            self.err(where, 'id must be [a-z0-9_]')
        if m.get('kind') not in KINDS:
            self.err(where, f'kind {m.get("kind")!r}')
        if m.get('level') not in LEVELS:
            self.err(where, f'level {m.get("level")!r}')
        if not isinstance(m.get('minutes'), int) or not 1 <= m['minutes'] <= 60:
            self.err(where, 'minutes must be 1..60')
        if m.get('topic') not in self.known_topics | VOCAB_TOPICS:
            self.err(where, f'unknown topic {m.get("topic")!r}')
        self.shown(f'{where}.title', m.get('title', ''))
        if m.get('kind') == 'book':
            return self.check_book(m, where)
        steps = m.get('steps')
        if not isinstance(steps, list) or not steps:
            return self.err(where, 'no steps')
        for i, st in enumerate(steps):
            self.check_step(st, f'{where}.steps[{i}]')
        curated = not (m.get('source') or {}).get('kind')
        seen_txt = {}
        for i, st in enumerate(steps):
            if st.get('type') != 'gap':
                continue
            ss = st.get('sentences') or []
            for j, x in enumerate(ss):
                t = NORM(x.get('text', ''))
                if t in seen_txt and seen_txt[t][0] != i:
                    pi, pa = seen_txt[t][1], seen_txt[t][2]
                    kind = 'with another answer (ambiguous)' if NORM(pa) != NORM(x.get('answer', '')) else 'again'
                    self.err(f'{where}.steps[{i}].sentences[{j}]', f'same sentence as steps[{pi}] {kind}: {x.get("text")}')
                seen_txt.setdefault(t, (i, i, x.get('answer', '')))
            if curated and ss:
                sw = f'{where}.steps[{i}]'
                if not 5 <= len(ss) <= 10:
                    self.warn(sw, f'quality: {len(ss)} sentences (5–10 for children)')
                starts = sum(1 for x in ss if x.get('text', '').lstrip('¿¡').startswith('___'))
                ends = sum(1 for x in ss if re.search(r'___\W*$', x.get('text', '')))
                if len(ss) >= 4 and (starts == len(ss) or ends == len(ss)):
                    self.warn(sw, 'quality: the gap is in the same place in every sentence')
                frames = [re.sub(r'(?<!^)\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+', 'X', x.get('text', '')) for x in ss]
                top = max(frames.count(f) for f in frames)
                if len(ss) >= 4 and top > len(ss) / 2:
                    self.warn(sw, f'quality: {top} of {len(ss)} sentences have the same pattern')
        if m.get('kind') == 'cards' and any(s.get('type') != 'cards' for s in steps):
            self.err(where, 'kind "cards" may only have cards steps')
        if m.get('kind') == 'worksheet' and not (m.get('source') or {}).get('kind'):
            types = {s.get('type') + (s.get('mode') or '') for s in steps if s.get('type') != 'text'}
            if len(types) < 2:
                self.err(where, 'curated worksheet needs at least 2 non-text activity types (§5.3)')

    def check_step(self, st, w):
        t = st.get('type')
        if t not in STEP_TYPES:
            return self.err(w, f'type {t!r}')
        if 'title' in st:
            self.shown(f'{w}.title', st['title'])
        if 'hint' in st:
            self.shown(f'{w}.hint', st['hint'])
        if t == 'text':
            for f in ('body', 'pic'):
                if not isinstance(st.get(f), str):
                    self.err(w, f'missing {f}')
        elif t == 'cards':
            ws = st.get('words') or []
            if not ws:
                self.err(w, 'no words')
            for x in ws:
                self.word(w, x)
        elif t == 'tap':
            items = st.get('items') or []
            if not items:
                self.err(w, 'no items')
            for j, it in enumerate(items):
                ww = f'{w}.items[{j}]'
                self.word(ww, it.get('word'))
                opts = it.get('options') or []
                if not 3 <= len(opts) <= 4 or len(set(opts)) != len(opts) or it.get('word') not in opts:
                    self.err(ww, 'options: 3–4 different vocab ids including word')
                for o in opts:
                    self.word(ww, o)
                sets = {self.vocab.get(o, {}).get('set') for o in opts}
                if len(sets) > 1:
                    self.err(ww, 'tap pictures from more than one set')
        elif t == 'match':
            ws, right = st.get('words') or [], st.get('right') or []
            if len(ws) < 3 or sorted(ws) != sorted(right) or len(set(ws)) != len(ws):
                self.err(w, 'words (≥3, distinct) and right must be the same ids')
            for x in ws:
                self.word(w, x)
        elif t == 'sort':
            bs = st.get('baskets') or []
            ids = [b.get('id') for b in bs]
            if len(bs) < 2 or len(set(ids)) != len(ids):
                self.err(w, 'need ≥2 baskets with distinct ids')
            for b in bs:
                if not b.get('label'):
                    self.err(w, 'basket without label')
                self.shown(f'{w}.basket', b.get('label', ''))
            cs = st.get('cards') or []
            if len(cs) < 2:
                self.err(w, 'need ≥2 cards')
            for c in cs:
                self.word(w, c.get('w'))
                if c.get('b') not in ids:
                    self.err(w, f'card {c.get("w")!r} in unknown basket {c.get("b")!r}')
            if len({c.get('w') for c in cs}) != len(cs):
                self.err(w, 'a card twice')
        elif t == 'gap':
            self.check_gap(st, w)

    def check_gap(self, st, w):
        mode = st.get('mode')
        if mode not in MODES:
            self.err(w, f'mode {mode!r}')
        ss = st.get('sentences') or []
        if not ss:
            return self.err(w, 'no sentences')
        for j, s in enumerate(ss):
            sw = f'{w}.sentences[{j}]'
            txt, a = s.get('text', ''), s.get('answer', '')
            if not isinstance(txt, str) or txt.count('___') != 1:
                self.err(sw, 'text needs exactly one ___')
            if not isinstance(a, str) or not a:
                self.err(sw, 'missing answer')
                continue
            self.shown(f'{sw}.text', txt)
            self.shown(f'{sw}.hint', s.get('hint', ''))
            if s.get('hint') and NORM(s['hint']) == NORM(a):
                self.err(sw, 'the hint is the answer')
            acc = s.get('accepts')
            if not isinstance(acc, list) or NORM(a) not in acc or any(x != NORM(x) for x in acc):
                self.err(sw, 'accepts must hold the answer, lower case')
            opts = s.get('options')
            if mode == 'typed' and opts == []:
                pass  # runtime materials: a typed question without choices
            elif not isinstance(opts, list) or not 2 <= len(opts) <= 4 or a not in opts \
                    or len({NORM(o) for o in opts}) != len(opts):
                self.err(sw, 'options: 2–4 different choices including answer')
            elif sum(1 for o in opts if NORM(o) in acc) != 1:
                self.err(sw, 'a wrong option is also accepted')
            elif txt.startswith('___') or txt.startswith('¿___') or txt.startswith('¡___'):
                if any(o[:1] != o[:1].upper() for o in opts):
                    self.err(sw, 'gap starts the sentence: capitalise every option')
            if 'en' in s and not isinstance(s['en'], str):
                self.err(sw, 'en must be text')
            for f in ('hint', 'teach'):
                if f in s and not isinstance(s[f], str):
                    self.err(sw, f'{f} must be text')
            item, topic = s.get('item'), s.get('topic')
            if not item or not topic:
                self.err(sw, 'item and topic needed (answers reach the star map)')
            elif topic in self.topics:
                if item not in self.topics[topic]:
                    self.err(sw, f'item {item!r} not in topic {topic}')
                else:
                    ex = next((e for e in self.topics[topic][item]['examples'] if e['sentence'] == txt), None)
                    if ex is None:
                        self.warn(sw, f'own sentence (not in {topic}): {txt}')
                    elif NORM(ex['answers'][0]) != NORM(a):
                        self.err(sw, f'answer {a!r} differs from the topic file {ex["answers"][0]!r}')
            elif topic not in self.known_topics:
                self.err(sw, f'unknown topic {topic!r}')
        if mode == 'drag':
            bank = st.get('bank')
            if not isinstance(bank, list):
                return self.err(w, 'drag step needs bank')
            rest = list(bank)
            for s in ss:
                if s.get('answer') in rest:
                    rest.remove(s['answer'])
                else:
                    self.err(w, f'bank lacks {s.get("answer")!r}')
            normed = [NORM(b) for b in bank]
            dup = sorted({b for b in normed if normed.count(b) > 1})
            if dup:
                self.err(w, f'drag bank has a word twice: {", ".join(dup)} (every answer once)')
            for j, x in enumerate(ss):
                if re.match(r'^[¿¡]?___', x.get('text', '').strip()):
                    self.err(f'{w}.sentences[{j}]', 'drag step: a gap at the start shows its answer by the capital letter (move the gap or use choice/typed)')
            if len(rest) < 2 and len(ss) > 2:
                self.err(w, f'drag bank needs at least 2 wrong extras (has {len(rest)}): the last gaps are solved by elimination')
        self.check_gap_quality(st, w)

    def check_gap_quality(self, st, w):
        # A v1 worksheet is the tutor's own question list: report, never fail it.
        err = self.warn if self.v1 else self.err
        if self.v1:
            w = f'{w} (tutor worksheet, quality)'
        ss = [s for s in st.get('sentences') or [] if isinstance(s.get('answer'), str) and s.get('answer')]
        n = len(ss)
        ans = [NORM(s['answer']) for s in ss]
        # give-aways
        for j, s in enumerate(ss):
            a = s['answer']
            if '→' in s.get('text', ''):
                continue  # verb chains (go → went → ___) show the earlier form on purpose
            verb = all(x in VERB_FORMS for x in NORM(a).split())
            key = NORM(a) if verb else stem(a)
            exact = verb
            for k, o in enumerate(ss):
                if '→' in o.get('text', ''):
                    continue
                seen = (o.get('text', '').replace('___', ' ') + ' ' + (o.get('hint') or ''))
                if ' ' in key:
                    hit = key in bare(seen)
                else:
                    hit = key in word_keys(seen, exact)
                if hit:
                    where = 'its own sentence' if k == j else f'sentence {k + 1} ({o.get("text")})'
                    err(f'{w}.sentences[{j}]', f'give-away: answer {a!r} is in {where}')
                if k != j:
                    t = o.get('teach') or ''
                    filled = bare(s.get('text', '').replace('___', a))
                    if filled and filled in bare(t):
                        err(f'{w}.sentences[{j}]', f'give-away: the teach line of sentence {k + 1} is this sentence filled in')
                    elif not verb and key not in word_keys(o['answer']) and key in word_keys(t):
                        err(f'{w}.sentences[{j}]', f'give-away: answer {a!r} is in the teach line of sentence {k + 1}')
        # variety
        run = 1
        for j in range(1, n):
            run = run + 1 if ans[j] == ans[j - 1] else 1
            if run == 3:
                err(w, f'answer {ss[j]["answer"]!r} three times in a row (sentences {j - 1}–{j + 1})')
        cap = max(2, round(0.4 * n))
        for a in sorted(set(ans)):
            if ans.count(a) > cap:
                err(w, f'answer {a!r} is {ans.count(a)} of {n} sentences (max {cap})')
        texts = [NORM(s.get('text', '')) for s in ss]
        for t in sorted({t for t in texts if texts.count(t) > 1}):
            err(w, f'sentence twice in the step: {t}')

    def check_book(self, m, w):
        pages = m.get('pages') or []
        if not pages:
            return self.err(w, 'no pages')
        story = 0
        for i, p in enumerate(pages):
            pw = f'{w}.pages[{i}]'
            if p.get('check') is True or p.get('end') is True:
                continue
            story += 1
            if p.get('scene') not in SCENES:
                self.err(pw, f'scene {p.get("scene")!r}')
            for c in p.get('cast') or []:
                if not (isinstance(c, list) and len(c) == 4 and isinstance(c[0], str)
                        and all(isinstance(n, (int, float)) for n in c[1:])):
                    self.err(pw, f'cast entry {c!r}')
            es = p.get('es', '')
            if not es or not p.get('en'):
                self.err(pw, 'es and en needed')
            if es.count('{') != es.count('}'):
                self.err(pw, 'unbalanced { }')
            for tw in TAPWORD.findall(es):
                parts = tw.split('|')
                if len(parts) not in (4, 5) or not all(parts[:4]):
                    self.err(pw, f'tap word {{{tw}}} needs shown|card word|meaning|picture[|vocab id]')
                elif len(parts) == 5:
                    self.word(pw, parts[4])
            self.shown(pw, TAPWORD.sub(lambda x: x.group(1).split('|')[0], es))
        if story < 1:
            self.err(w, 'no story pages')
        if not any(p.get('end') for p in pages):
            self.err(w, 'no end page')
        checks = ([m['check']] if any(p.get('check') for p in pages) else []) + list(m.get('endChecks') or [])
        if any(p.get('check') for p in pages) and not m.get('check'):
            self.err(w, 'check page without check')
        for k, c in enumerate(checks):
            cw = f'{w}.check[{k}]'
            self.shown(cw, c.get('q', ''))
            opts = c.get('options') or []
            for o in opts:
                self.word(cw, o)
            if c.get('answer') not in opts or len(opts) < 2:
                self.err(cw, 'answer must be one of the options')
        for x in m.get('words') or []:
            self.word(w, x)

    # ── files ──
    def check_topic_sentences(self):
        """The same sentence in two topic files must have the same answer."""
        seen = {}
        for tid, items in sorted(self.topics.items()):
            for iid, it in items.items():
                for e in it.get('examples', []):
                    t, a = NORM(e['sentence']), NORM(e['answers'][0])
                    if t in seen and seen[t][1] != a:
                        self.err(f'{tid}.{iid}', f'sentence also in {seen[t][0]} with answer {seen[t][1]!r}: {e["sentence"]}')
                    seen.setdefault(t, (f'{tid}.{iid}', a))
                    if REGIONAL.search(' '.join([e['sentence'], *e['answers'], *e.get('distractors', [])])):
                        self.err(f'{tid}.{iid}', f'not safe for Uruguay/Argentina: {e["sentence"]} {e["answers"]}')
                    if '→' not in e['sentence']:
                        a0 = e['answers'][0]
                        verb = all(x in VERB_FORMS for x in NORM(a0).split())
                        key = NORM(a0) if verb else stem(a0)
                        if ' ' not in key and key in word_keys(e['sentence'].replace('___', ' '), verb):
                            self.err(f'{tid}.{iid}', f'give-away: answer {a0!r} is in the sentence: {e["sentence"]}')

    def check_repo(self):
        self.check_vocab()
        self.check_topic_sentences()
        mdir = CONTENT / 'materials'
        try:
            index = json.loads((mdir / 'index.json').read_text())
        except Exception as e:  # noqa: BLE001
            return self.err('index.json', str(e))
        files = sorted(p.name for p in mdir.glob('*.json') if p.name != 'index.json')
        listed = [e.get('file') for e in index]
        for f in set(files) - set(listed):
            self.err('index.json', f'{f} not listed')
        ids = set()
        for e in index:
            f = e.get('file')
            if f not in files:
                self.err('index.json', f'{f} missing')
                continue
            m = json.loads((mdir / f).read_text())
            self.check_material(m, f)
            if m.get('id') in ids:
                self.err(f, 'duplicate id')
            ids.add(m.get('id'))
            if f != m.get('id', '').removeprefix('m_').replace('_', '-') + '.json':
                self.err(f, 'file name must follow the id')
            for k in ('id', 'kind', 'title', 'topic', 'level', 'minutes', 'blurb'):
                if e.get(k) != m.get(k):
                    self.err('index.json', f'{f}: {k} differs from the file')
        # served copies identical
        pairs = [(CONTENT / 'vocab' / 'es.json', SERVED / 'vocab' / 'es.json')]
        pairs += [(mdir / f, SERVED / 'materials' / f) for f in files + ['index.json']]
        for a, b in pairs:
            if not b.exists() or a.read_bytes() != b.read_bytes():
                self.err(str(b.relative_to(ROOT)), f'differs from {a.relative_to(ROOT)} (copy it)')
        extra = {p.name for p in (SERVED / 'materials').glob('*.json')} - set(files) - {'index.json'}
        for f in extra:
            self.err(f'homepage/data/materials/{f}', 'not in content/materials')
        return len(files)


def main(argv):
    c = Checker()
    if argv:
        for a in argv:
            data = json.loads(Path(a).read_text())
            for k, m in enumerate(data if isinstance(data, list) else [data]):
                c.check_material(m, f'{Path(a).name}[{k}]')
        n = len(argv)
    else:
        n = c.check_repo()
    for wmsg in c.warnings:
        print('info ', wmsg)
    for e in c.errors:
        print('ERROR', e)
    own = sum(1 for x in c.warnings if 'own sentence' in x)
    print(f'{n} file(s), {len(c.vocab)} words: {len(c.errors)} error(s), {own} own sentence(s), '
          f'{len(c.warnings) - own} quality note(s)')
    return 1 if c.errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
