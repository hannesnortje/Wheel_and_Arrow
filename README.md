# The Wheel and the Arrow · Das Rad und der Pfeil · Die Wiel en die Pyl

A booklet and a small installable web app on personal leadership and goal setting by
**Dr. Johannes (Hannes) A. Nortjé** – in German, English and Afrikaans.

**Live:** https://hannesnortje.github.io/Wheel_and_Arrow/

## What's in it
- **The booklet** – six short chapters, each opened by a Bible passage (own translation from the Hebrew and Greek):
  Being and Becoming · Defining Success · The Inner Foundation · The Wheel of Life · Goal Setting · First Steps.
  Read it in the app, or download it as an A5 PDF with printable worksheets.
- **Wheel of Life** – score six areas of your life and see the shape of your wheel; download it as an image.
- **Goal Planning Worksheet** – turn one goal into a dated plan; download it as a fillable PDF.
- **Whole-Life Goal Plan** – a mission statement and goals for every area.
- **Slides** (presenter view and PDF) and leader's notes for teaching it in a group.

Everything you enter stays in your browser – no cookies, no tracking, no server. The app works offline once
installed ("Add to Home Screen") and updates itself when a new version is published.

The definition of success is quoted from Paul J. Meyer. The booklet is inspired by the personal-development
tradition, including Meyer's work; it is not affiliated with or endorsed by Leadership Management International.
The claim about a "3% Yale goals study" has been removed – that study never took place; the booklet cites Gail
Matthews' real (small) study instead.

## Working on it
```bash
python3 build/build.py          # site → en/ de/ af/ assets/ index.html sw.js … (repo root = GitHub Pages)
python3 build/pdf.py            # booklet, slides, leader's notes → pdf/   (then run build.py again)
python3 build/worksheet_pdf.py  # fillable goal worksheet per language → src/assets/ and pdf/
```
Sources: `content/` (booklet-<lang>.md, slides-<lang>.yml, example-<lang>.yml, bible.md, CHANGES.md),
`src/` (templates, styles, scripts, tools' texts in src/i18n/, legal.yml). Don't edit the generated folders by
hand. Details for future changes: see CLAUDE.md.

Licence: content CC BY-NC-ND 4.0, code MIT – see [LICENSE.md](LICENSE.md).
