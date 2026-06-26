# The Wheel and the Arrow

> *A Disciple's Guide to Personal Leadership and Goal Setting — as two small, private, browser-based tools.*

This project brings the core exercises from **_The Wheel and the Arrow_** (Dr. Johannes A. Nortjé,
adapted from the Personal Leadership materials of Leadership Management International) to life on the
web. Where the booklet asks you to print a worksheet and reach for a pen, these tools let you do the
same work interactively in a browser — and walk away with a clean file to keep.

There are two tools, mirroring the two instruments in the booklet:

1. **The Wheel of Life** — see *where you are today*.
2. **The Goal Planning Worksheet** — chart *where you are going*.

The wheel shows your current reality; the arrow is the goal that moves you forward. Together they
bridge **Being** and **Becoming**.

---

## The idea behind it

Personal Leadership is the quiet, constant work of managing *yourself* — who you are at work, at
home, in your community, and when you're completely alone. The booklet defines success not as a
destination but as a direction:

> success is *"the progressive realisation of your worthwhile, predetermined personal goals."*

To pursue it honestly you need two things: an honest picture of your **current reality**, and
**written goals** that stretch you toward your potential. A landmark finding the booklet cites — that
only a small minority who put their goals *in writing* dramatically out-perform everyone else — is the
whole reason these tools exist: to make capturing that wheel and those goals effortless.

Both tools are organised around the **"Total Person"** — the six interdependent life areas that, kept
in balance, let a life run smoothly rather than in conflict:

| Area | What it covers |
|------|----------------|
| **Ethics & Values** | Your moral foundation, spiritual life, and guiding principles |
| **Society & Community** | Relationships outside the home, service, and social life |
| **Family & Home** | Your spouse, children, and immediate environment |
| **Work & Finances** | Career, professional performance, and financial stewardship |
| **Body & Health** | Physical vitality, fitness, nutrition, and rest |
| **Mind & Learning** | Intellectual development, mental clarity, and skills |

---

## The tools

### 🛞 The Wheel of Life — [`index.html`](index.html)

An interactive self-assessment. For each of the six areas you ask *"Where am I today, on a scale of
1 to 10, against the standards I set for myself?"* — 1 at the centre (not at all satisfied), 10 at the
rim (fully satisfied).

- Drag a slider, or click directly on a wedge, to set each score.
- The shape of your wheel draws itself as you go — round and full, or jagged and flat.
- Add your name and date, then **download your wheel as a PNG** to keep or revisit.
- Fully responsive: full-width on a phone, larger side-by-side layout on a computer.

### 🎯 The Goal Planning Worksheet — [`goals.html`](goals.html)

The booklet's primary engine, made fillable. Turn an intention into a dated, trackable plan with a
**SMART** goal (Specific, Measurable, Attainable, Relevant/Realistic, Time-bound) and work through
every section that makes a goal stick:

- **Life Area** (chosen from the six wheel areas) with **Started / Target / Achieved** date pickers.
- **The Goal**, **Why It Matters**, **What Could Get in the Way / How I'll Handle It**.
- A 15-row **Action Steps** table with Due / Reviewed dates and a Done checkbox per step.
- **Who Should Know**, **How I'll Track Progress**, a **Worth It?** alignment check, and
  **Encouraging Reminders / Ways to Picture Success**.
- **Download** a pre-filled, *still-editable* PDF (you can keep changing text and ticking boxes in any
  PDF reader), or **Print** the finished worksheet directly.

A link on the Wheel page leads straight to the worksheet.

---

## Privacy

Nothing is uploaded. Everything you type, score, and tick stays in your browser on your own computer —
there is no server, no account, and no analytics. The downloaded PNG and PDF are generated locally.
Use the download buttons to keep your own copies.

---

## How it works

These are **plain static HTML files** — no build step, no framework, no dependencies to install.
Open them directly in a browser (or serve the folder with any static web server) and they run.

The Goal Planning Worksheet produces its PDF by filling the **original worksheet's form fields**: the
reference `Goal_Planning_Worksheet.pdf` is a fillable AcroForm, and the page fills its fields from
your entries using [pdf-lib](https://pdf-lib.js.org/). To stay fully offline, both pdf-lib and the
template are vendored locally (the template is embedded as base64), so no network request is ever made.

### Project structure

```
.
├── index.html                      # The Wheel of Life (home page)
├── goals.html                      # The Goal Planning Worksheet
├── assets/
│   └── Goal_Planning_Worksheet.pdf # The fillable PDF template (source of truth)
├── vendor/
│   ├── pdf-lib.min.js              # PDF library (vendored, offline)
│   └── goal-template.js            # The template PDF as base64 (window.GOAL_TEMPLATE_B64)
└── README.md
```

## Running it

No installation required:

- **Simplest:** open `index.html` in your browser.
- **Or serve the folder** (avoids any local-file quirks), e.g.:
  ```bash
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

## Maintenance — updating the worksheet template

If the worksheet PDF changes, refresh all three of these so browsers pick up the new version:

1. Replace `assets/Goal_Planning_Worksheet.pdf` with the new file.
2. Regenerate the embedded copy:
   ```bash
   {
     echo '// Auto-generated: base64 of assets/Goal_Planning_Worksheet.pdf (fillable AcroForm template).'
     echo "window.GOAL_TEMPLATE_B64 = \"$(base64 -w0 assets/Goal_Planning_Worksheet.pdf)\";"
   } > vendor/goal-template.js
   ```
3. Bump the `?v=` number on the `goal-template.js` script tag in `goals.html` (cache-busting).

> The worksheet's PDF form field names (`life_area`, `the_goal`, `action_1`…`action_15`, `due_*`,
> `reviewed_*`, `done_*`, `worth_*`, etc.) are what `goals.html` writes into — keep them consistent if
> the template is regenerated.

---

## Credits

- **Content & framework:** *The Wheel and the Arrow — A Disciple's Guide to Personal Leadership and
  Goal Setting*, Dr. Johannes A. Nortjé, adapted from the Personal Leadership materials of
  **Leadership Management International (LMI)**.
- **PDF generation:** [pdf-lib](https://pdf-lib.js.org/).
