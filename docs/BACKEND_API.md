# FrenchLens backend API (v1)

The iOS client talks only to the FrenchLens backend. The backend owns every AI
provider key and chooses providers. All bodies are JSON (UTF-8) except uploads.

Base URL: `FRENCHLENS_API_BASE_URL` (see README). Every request carries
`X-FrenchLens-Client: FrenchLens-iOS/<version>`. Errors return a non-2xx status
and `{ "error": "human readable message" }`.

The client is implemented in `FrenchLens/Services/Networking/APIClient.swift`
and the three `Remote*Service` types.

---

## POST /v1/transcriptions

`multipart/form-data`

| Field      | Value                                 |
| ---------- | ------------------------------------- |
| `file`     | Audio (`audio/mp4`, `.m4a`) extracted on device from the shared video |
| `language` | `fr-FR`                               |

Response — `TranscriptionResult`:

```json
{
  "text": "Aujourd'hui, je vais vous montrer comment je prépare mon petit-déjeuner.",
  "languageCode": "fr-FR",
  "segments": [
    { "start": 0.0, "end": 4.2, "text": "Aujourd'hui, je vais vous montrer comment je prépare mon petit-déjeuner." }
  ]
}
```

## POST /v1/analyses

Request:

```json
{
  "transcript": { "text": "…", "languageCode": "fr-FR", "segments": [ … ] },
  "level": "A1",
  "explanationLanguage": "en",
  "schemaVersion": 1
}
```

`level` is one of `A1`, `A2`, `B1`, `B2`. Generate explanations for that level:
A1 simple English · A2 simple + examples · B1 more nuance · B2 French-first with
register and context (`explanationLanguage` is `fr` for B2).

Response — `LessonAnalysis` (see `FrenchLens/Models`). Rules the model must follow:

- **Translation** is natural English first (`translation.natural`); `literal` is optional.
- **Vocabulary**: only useful items, not every word.
- **Verbs**: every important verb with `infinitive`, `english`, exact `formUsed`,
  `tense`, `person`, `auxiliary` (compound tenses), `conjugation` in the tense used.
- **Expressions**: idioms with `literal`, `natural`, `register`
  (`formal` | `neutral` | `informal` | `slang`), `cefr`.
- **Grammar**: only grammar present in the content; `excerpt` must be a substring
  of the transcript.
- **Transcript tokens**: tokens joined by single spaces must equal the sentence.
  Tappable tokens carry `lookup`, which must match a `glossary[].key`.
- Explanations (`note`, `explanation`, `tip`) are either a string or
  `{ "a1": "…", "a2": "…", "b1": "…", "b2": "…" }` (only `a1` required).

Abbreviated example:

```json
{
  "title": "Breakfast, step by step",
  "cefrLevel": "A1",
  "transcript": {
    "segments": [
      {
        "id": "s1", "start": 0.0, "end": 4.2,
        "translation": "Today, I'm going to show you how I make my breakfast.",
        "tokens": ["Aujourd'hui,", "je", { "text": "vais", "lookup": "aller" }, "vous",
                   { "text": "montrer", "lookup": "montrer" }, "comment", "je",
                   { "text": "prépare", "lookup": "preparer" }, "mon",
                   { "text": "petit-déjeuner.", "lookup": "petit_dejeuner" }]
      }
    ]
  },
  "translation": { "natural": "Today I'm going to show you how I make my breakfast." },
  "vocabulary": [ { "french": "le petit-déjeuner", "english": "breakfast", "cefr": "A1" } ],
  "verbs": [
    {
      "infinitive": "préparer", "english": "to prepare, to make", "formUsed": "prépare",
      "tense": "présent", "person": "je · 1st person singular", "cefr": "A1",
      "conjugation": [ { "pronoun": "je", "form": "prépare" }, { "pronoun": "tu", "form": "prépares" } ]
    }
  ],
  "expressions": [],
  "grammar": [
    {
      "id": "aller-infinitive", "title": "Aller + infinitive", "pattern": "aller (présent) + infinitive",
      "excerpt": "je vais vous montrer", "cefr": "A1", "examples": ["Je vais manger."],
      "explanation": { "a1": "Used for the near future. Je vais montrer = I'm going to show." }
    }
  ],
  "pronunciation": [],
  "glossary": [
    { "key": "preparer", "lemma": "préparer", "english": "to prepare", "partOfSpeech": "verb", "cefr": "A1",
      "forms": [ { "pronoun": "je", "form": "prépare" }, { "pronoun": "tu", "form": "prépares" },
                 { "pronoun": "il/elle", "form": "prépare" } ] }
  ]
}
```

Full, valid examples: `FrenchLens/Resources/DemoLessons/*.json` (each file's
`analysis` object).

## POST /v1/translations

Fallback used only if an analysis arrives without `translation.natural`.

```json
{ "text": "…", "source": "fr", "target": "en", "style": "natural" }
```

Response: `{ "translation": "…" }`

---

### What the backend must never do

Accept a social-media URL and fetch, scrape or download the media behind it.
The client only ever uploads media the user provided through the Share Sheet or
Photos. Links are provenance, not input.
