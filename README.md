# SAT Practice

A self-contained website for practicing your SAT question bank by **category, topic, and
difficulty**, with a **timer**. Questions and worked solutions are the original PDF pages
rendered in the browser (so every table, figure, and math expression is preserved exactly).

- **1,410 questions** across SAT Math and Reading & Writing
- Filter by category → topic → difficulty, choose length, shuffle, and timer mode
- Multiple-choice **and** student-produced (grid-in) answers, auto-graded
- Per-question + total timers with an optional **exam-pace** indicator
  (Math ≈ 95 s/question, R&W ≈ 71 s/question)
- Full worked-solution explanation revealed after each answer
- Tracks your score, accuracy by topic/difficulty, flagged questions, and lifetime progress
  (saved in your browser)
- Light & dark themes

## How to open it

### Option A — just open the file (no setup)
Double-click **`index.html`**. It runs entirely offline in your browser; nothing is uploaded.
Works in Chrome, Edge, and Firefox.

### Option B — run the tiny local server
If your browser is locked down and Option A misbehaves, double-click
**`start-server.bat`**, then go to <http://localhost:8777>. (Uses the Perl that ships with
Git for Windows.)

## Keyboard shortcuts (during practice)
| Key | Action |
|-----|--------|
| `1`–`4` or `A`–`D` | choose an answer |
| `Enter` | submit / next |
| `F` | flag question for review |
| `S` | skip |
| `P` | pause/resume |

## How it was built
`build.sh` parses the bank's PDFs with `pdftotext`: question metadata, the correct answer,
and difficulty come from the answer-key PDFs; categories/topics come from the folder names.
Each question/answer PDF is base64-embedded under `data/` and rendered on demand with
PDF.js (`vendor/`). Re-run with `bash build.sh` if you update the source PDFs.

Folders:
- `data/questions.js` — the question manifest (id, category, topic, difficulty, answer, page refs)
- `data/q/`, `data/a/` — base64-encoded question and answer-key PDFs (lazy-loaded)
- `vendor/` — PDF.js library + inlined worker
