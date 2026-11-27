# Question topic format v2 ("gap topic")

The format for every **new** topic, in any learning language (direction:
`docs/vision.md`). The two original topics keep their own formats
(`irregular-verbs.json`, `prepositions.json`); v2 is the preposition
format generalised.

A topic file lives here in `content/<file>.json` (canonical copy) and is
synced to `homepage/data/<file>.json` at release.

## File

```json
{
  "format": 2,
  "id": "es_ser",
  "learn_lang": "es",
  "level": "A1",
  "title": { "en": "I am … (ser)", "es": "Yo soy … (ser)", "de": "Ich bin … (ser)" },
  "items": [
    {
      "id": "ser_name",
      "group": "name",
      "label": "soy + name",
      "explanation": {
        "en": "To say your name: Yo soy + name. You can leave out 'yo': Soy Ana.",
        "es": "Para decir tu nombre: Yo soy + nombre.",
        "de": "Deinen Namen sagst du mit: Yo soy + Name."
      },
      "distractors": ["estoy", "es", "eres"],
      "examples": [
        { "sentence": "Yo ___ Lucas.", "answers": ["soy"], "difficulty": 1 },
        { "sentence": "Hola, ___ Ana.", "answers": ["soy"], "difficulty": 1 }
      ]
    },
    {
      "id": "ser_describe_tall",
      "group": "describe",
      "label": "soy + alto/alta",
      "explanation": { "en": "A boy is alto, a girl is alta." },
      "examples": [
        { "sentence": "Soy Pablo. Mi hermana es alta y yo también soy ___.",
          "answers": ["alto"],
          "distractors": ["alta", "altas", "altos"], "difficulty": 2 }
      ]
    }
  ]
}
```

## Fields

**Topic**

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | always `2` |
| `id` | yes | topic id, `[a-z0-9_]`, starts with the learning language (`es_ser`). Same id as in the registry |
| `learn_lang` | yes | language being learned (`es`, `en`, …) |
| `level` | no | CEFR level `A1`, `A2`, `B1` … (sorting topics, not filtering questions) |
| `title` | yes | per interface language |
| `items` | yes | the units a child learns (stats + smart mix count per item) |

**Item** (one thing to learn, like a preposition use case)

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | `[a-z0-9_]`, unique within the topic, **stable** (stats are stored under it). ASCII only: the class API rejects other ids |
| `group` | no | sub-group for teachers' filters later (`name`, `origin`, `describe`) |
| `label` | no | short pattern shown to teachers / in teach lines (`soy + name`) |
| `explanation` | yes | teach note per interface language, shown **after** the answer. Grammar terms are allowed here, in small doses |
| `distractors` | yes* | wrong choices for all examples of the item. *Can be left out if every example has its own |
| `examples` | yes | the actual questions |

**Example** (one question)

| Field | Required | Meaning |
|---|---|---|
| `sentence` | yes | in the learning language, exactly one `___` |
| `answers` | yes | first = canonical answer; more = also accepted when typed (`["soy", "Soy"]` is not needed: typing is case-insensitive) |
| `hint` | no | **don't use** (owner decision 2026-11-26, see rules below). The engine still shows one in brackets after the sentence if present, for old data |
| `distractors` | no | overrides the item's wrong choices for this question |
| `difficulty` | no | 1–3 within the topic, default 1 |

## Rules for writing questions

- **No grammar terms in the question** (site rule). The sentence must be
  enough. "Simple Present", "1st person" etc. only in
  `explanation`.
- **Only the learning language in the question** (owner decision
  2026-11-26). No translation or clue in the interface language, no
  `(tall)` after the gap. Write the sentence so that it alone settles
  the answer, also when typed: put the word in the sentence in another
  form (`Mi hermana es alta y yo también soy ___.` → alto) or give a
  context with only one fit (`Quiero agua. Tengo ___.` → sed).
- **Wrong choices must teach something.** For ser: `soy / estoy / es /
  eres` (same verb, other person, or the verb it gets confused with), not
  random words. At least 3 per question (games show 2–4 options).
- **Wrong choices must really be wrong** in that sentence. `alta` is only
  wrong if the sentence says it's a boy (`Soy Pablo …`); `sed` can't be a
  wrong choice in `Es verano y tengo ___.` (summer makes you thirsty too).
- **All options look alike.** When the gap starts a sentence, capitalise
  the answer *and* every wrong choice (`Soy / Estoy / Es / Eres`); a lone
  lowercase or uppercase option gives the answer away.
- **Labels are unique per topic** (games show them as the item name).
- One gap per sentence. Keep sentences short (games have small cards).
- Interface languages: write `en` first (pilot interface), add `es`/`de`
  when that interface goes live. Missing languages fall back
  requested → en → site default → any (`pickLang`, lib/krabsy-lang.js).
  `tools/check_catalogues.py` requires the explanation in every interface
  language of a section that shows the topic.
- Accents count when typed (`está` ≠ `esta`); choice games are unaffected.

## Registering a topic

1. Add the file here and copy it to `homepage/data/` (file name = topic id with
   `-` for `_`, e.g. `es_ser_estar` → `es-ser-estar.json`; Fill the Gap finds it by that rule).
2. The topic's entry in `homepage/data/topics.json`:
   `"subject": "spanish", "level": "A1", "shapes": ["quiz"], "file": "es-ser.json"`
   (+ its URL slug per interface language, below), then
   `python3 tools/krabsy_registry.py` (browser registry + `api/catalog.json`).
3. Deploy the API too (it reads `api/catalog.json`; else class stats drop the answers).
4. Quiz Room: `TOPICS` in `games/quiz-show/src/questions.js`, `topic_<id>` and
   `diff_<id>` in `src/i18n.js` (EN/DE/ES); copy `src/` to `homepage/games/quiz-room/`.
5. Section pages (Spanish for English speakers, CLAUDE.md "Sections"):
   `homepage/data/topics.json` entry with its `en` URL (`spanish/<slug>`), the topic id
   in the `topics` of every game that should play it (`games.json`), a row in `TOPICS`
   of `tools/build_en_spanish.py`, a card + filter chip on `homepage/en/spanish/index.html`;
   then `python3 tools/build_en_spanish.py && python3 tools/render_static_games.py &&
   python3 tools/render_game_info.py`.
6. Review sheet for a teacher: `python3 tools/es_review_sheet.py content/<file>.json > docs/<name>.md`.
7. `python3 tools/check_catalogues.py` (required fields, unique ids, language maps,
   topics.json / sections.json / games.json / ui_*.json consistency; exit 1 on errors).

Games need no change: they pick their menu texts by learning language (`es_…` →
Spanish), and the game pages choose the topic via `?topic=` or the last topic visited.

The engine then serves it via `getQuizSet({ topic: 'es_ser', lang })` and
`getQuestions({ topic: 'es_ser' })`; `?topic=es_ser` works in every game
that reads `topicFromUrl()` and takes the `quiz` shape.
