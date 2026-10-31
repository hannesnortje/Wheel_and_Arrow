# Wheel and Arrow – instructions for Claude

Booklet + PWA by Dr. Johannes A. Nortjé (Hannes) in German, English and Afrikaans.
GitHub Pages serves the **repository root** (branch main) – the generated folders are committed.

## Rules
- **No LMI.** Never reintroduce "adapted from LMI", "Total Person" or LMI wording. Paul J. Meyer's definition of
  success stays, quoted with attribution. Keep the "not affiliated" note (strings.py `not_affiliated`).
- **No myths.** The "3% Yale/Harvard goals study" never happened. Cite Gail Matthews (2007) honestly as small.
- **Bible text is our own translation** (content/bible.md, from SBLGNT/WLC) – never paste copyrighted Bibles.
- Hannes's theological positions stay as he wrote them; report every factual correction to him (content/CHANGES.md).
- German addresses the reader with **du**. Text changes go into all three languages.
- Don't rename, move or edit Hannes's Google Docs (the original booklet is in Drive, read only).
- Users' data lives in localStorage keys `wheel_of_life_v1`, `goals_worksheet_v1`, `whole_life_goal_plan_v1`
  (+ tutorial keys, shell key `wa-state`). Never break these shapes; migrate on load instead.
- Store area ids (ethics, mind, society, body, family, work – src/i18n/areas.json), never translated names.
- Don't edit generated output by hand: en/ de/ af/ assets/ pdf/ index.html goals.html whole-life.html sw.js manifest.webmanifest.

## Commands
```bash
python3 build/build.py          # site
python3 build/pdf.py            # booklet/slides/notes PDFs (then build.py again so the service worker lists them)
python3 build/worksheet_pdf.py  # fillable goal worksheet PDFs
```

## Where things are
- content/ – booklet-<lang>.md (`# n | Title`, `@verse n`, `@wheel`, `@example`), slides-<lang>.yml, example-<lang>.yml,
  bible.md, CHANGES.md, TRANSLATION-NOTES.md
- build/ – build.py, strings.py (shell texts), pdf.py, worksheet_pdf.py, legacy/ (the original single-page tools)
- src/templates – base (shell + ☰ menu), home, booklet, tools/<tool>.html, about, legal, slides, print_booklet, router
- src/assets – style.css (shared UI), app.js (language memory, menu, service worker updates), <tool>.js/.css, booklet.css, slides.css
- src/i18n – areas.json + one JSON per tool; src/legal/legal.yml – imprint
