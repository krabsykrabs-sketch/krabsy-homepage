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
        { "sentence": "Me llamo Pablo. Soy ___.", "answers": ["alto"],
          "hint": { "en": "tall", "de": "groß", "es": "" },
          "distractors": ["alta", "altos", "bajo"], "difficulty": 2 }
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
| `hint` | no | per interface language; shown in brackets after the sentence: `Me llamo Pablo. Soy ___. (tall)`. Use it when the sentence alone doesn't tell the child *what* to say |
| `distractors` | no | overrides the item's wrong choices for this question |
| `difficulty` | no | 1–3 within the topic, default 1 |

## Rules for writing questions

- **No grammar terms in the question** (site rule). The sentence and the
  hint must be enough. "Simple Present", "1st person" etc. only in
  `explanation`.
- **Wrong choices must teach something.** For ser: `soy / estoy / es /
  eres` (same verb, other person, or the verb it gets confused with), not
  random words. At least 3 per question (games show 2–4 options).
- **Wrong choices must really be wrong** in that sentence. `Soy ___ (tall)`
  with `alta` as a wrong choice only works if the sentence says it's a boy.
- One gap per sentence. Keep sentences short (games have small cards).
- Interface languages: write `en` first (pilot interface), add `es`/`de`
  when that interface goes live. Missing languages fall back
  en → de → es.
- Accents count when typed (`está` ≠ `esta`); choice games are unaffected.

## Registering a topic

1. Add the file here and copy it to `homepage/data/`.
2. Add a row to `TOPIC_REGISTRY` in `homepage/lib/krabsy-data.js`:
   `es_ser: { learn: 'es', level: 'A1', shapes: ['quiz'], file: 'es-ser.json' }`.
3. Add the id to `TOPICS` in `api/classes.py` (else class stats drop the
   answers) and deploy the API.
4. Games that keep their own topic list (Quiz Room `src/questions.js`,
   `src/i18n.js` topic names) need the id too.

The engine then serves it via `getQuizSet({ topic: 'es_ser', lang })` and
`getQuestions({ topic: 'es_ser' })`; `?topic=es_ser` works in every game
that reads `topicFromUrl()` and takes the `quiz` shape.
