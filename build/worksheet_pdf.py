#!/usr/bin/env python3
"""Fillable Goal Planning Worksheet in en/de/af.

1. Syncs the booklet example (content/example-<lang>.yml), the section labels (build.py EX_LABELS) and the
   area-name aliases (src/i18n/areas.json) into src/i18n/goals.json, so app, booklet and PDF use the same words.
2. Renders src/templates/print_worksheet.html with Playwright to a 2-page A4 PDF (fonts Literata/Inter).
3. Measures every box marked data-f="<field>" and adds AcroForm fields with exactly those names
   (the names of the original worksheet: life_area, the_goal, action_N, due_N, done_N, …) using pdf-lib in Node.

Output: src/assets/worksheet-<lang>.pdf (the app fills it) and a blank copy pdf/goal-worksheet-<lang>.pdf.

    python3 build/worksheet_pdf.py        (then python3 build/build.py)
"""
import datetime
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))
from build import EX_LABELS, SRC, env, example_data, load_json  # noqa: E402
from strings import LANGS, STRINGS  # noqa: E402

GOALS_JSON = SRC / "i18n" / "goals.json"
AUTHOR = "Dr. Johannes A. Nortjé"
MONTHS = {"jan": 1, "feb": 2, "mar": 3, "mär": 3, "maa": 3, "apr": 4, "may": 5, "mai": 5, "mei": 5, "jun": 6, "jul": 7,
          "aug": 8, "sep": 9, "oct": 10, "okt": 10, "nov": 11, "dec": 12, "dez": 12, "des": 12}
YES = {"yes", "ja"}


def iso(text, year):
    """'1 Oct' / '1. Okt.' / '31 December 2025' -> '2025-10-01'; anything else ('Weekly') -> ''."""
    m = re.match(r"(\d{1,2})\.?\s+([A-Za-zäÄ]{3})\w*\.?(?:\s+(\d{4}))?$", str(text).strip())
    if not m or m.group(2).lower() not in MONTHS:
        return ""
    return f"{int(m.group(3) or year):04d}-{MONTHS[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"


def sample_goal(lang, area_alias, name):
    e, L = example_data(lang), EX_LABELS[lang]
    year = re.search(r"\d{4}", str(e["started"])).group(0)
    g = {"name": name, "life_area": area_alias.get(e["area"], ""), "started": iso(e["started"], year),
         "target_date": iso(e["target"], year), "achieved_on": iso(e["achieved"], year), "the_goal": e["goal"],
         "why_matters": f"{L['gain']}: {e['gain']}\n{L['avoid']}: {e['avoid']}",
         "obstacles": "\n".join(f"{i}. {o}" for i, (o, _) in enumerate(e["obstacles"], 1)),
         "handling": "\n".join(f"{i}. {h}" for i, (_, h) in enumerate(e["obstacles"], 1)),
         "who_should_know": "\n".join(f"• {w}" for w in e["who"]), "track_progress": e["track"],
         "worth_value_yes": e["worth"][0] == "yes", "worth_value_no": e["worth"][0] != "yes",
         "worth_cost_yes": e["worth"][1] == "yes", "worth_cost_no": e["worth"][1] != "yes", "worth_cost_later": False,
         "reminders": e["reminder"], "picture_success": e["picture"]}
    for i, (step, due, rev, done) in enumerate(e["steps"], 1):
        g[f"action_{i}"] = step
        g[f"due_{i}"] = iso(due, year)
        g[f"reviewed_{i}"] = iso(rev, year)
        g[f"done_{i}"] = str(done).strip().lower() in YES
    return g


def sync_strings():
    d = load_json(GOALS_JSON)
    areas = load_json(SRC / "i18n" / "areas.json")
    alias = {areas[l][i][0]: i for l in LANGS for i in areas["ids"]}
    for lang in LANGS:
        d[lang]["ex"] = EX_LABELS[lang]
        d[lang]["sample"] = sample_goal(lang, alias, d[lang].get("sample_name", ""))
    d["en"]["_area_alias"] = alias   # every language falls back to en for missing keys
    GOALS_JSON.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return d


NODE = r"""
const fs = require('fs');
const PDFLib = require(process.argv[2]);
const { PDFDocument, StandardFonts, PDFName, rgb } = PDFLib;
const noBg = (field) => field.acroField.getWidgets().forEach(w => {   // the HTML draws the boxes; no white fill
  const mk = w.getAppearanceCharacteristics(); if (mk) { mk.dict.delete(PDFName.of('BG')); mk.dict.delete(PDFName.of('BC')); }
});
(async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const doc = await PDFDocument.load(fs.readFileSync(spec.src));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  const pages = doc.getPages();
  const ink = rgb(0x1d / 255, 0x2a / 255, 0x31 / 255), sea = rgb(0x16 / 255, 0x46 / 255, 0x5a / 255);
  for (const f of spec.fields) {
    const page = pages[f.page], H = page.getHeight();
    const i = 1.2;   // stay inside the drawn border
    const r = { x: f.x + i, y: H - f.y - f.h + i, width: f.w - 2 * i, height: f.h - 2 * i, borderWidth: 0 };
    if (f.cb) {
      const cb = form.createCheckBox(f.name);
      cb.addToPage(page, { ...r, textColor: sea });
      noBg(cb);
    } else {
      const tf = form.createTextField(f.name);
      if (f.ml) tf.enableMultiline();
      tf.addToPage(page, { ...r, x: r.x + 1.5, width: r.width - 3, y: r.y + (f.ml ? 1.5 : 0), height: r.height - (f.ml ? 3 : 0), font, textColor: ink });
      tf.setFontSize(f.fs);
      noBg(tf);
    }
  }
  form.updateFieldAppearances(font);
  doc.setTitle(spec.title); doc.setAuthor(spec.author); doc.setSubject(spec.subject);
  doc.setLanguage(spec.lang); doc.setCreator('The Wheel and the Arrow'); doc.setProducer('pdf-lib');
  doc.setCreationDate(new Date(spec.date)); doc.setModificationDate(new Date(spec.date));
  fs.writeFileSync(spec.out, await doc.save());
})().catch(e => { console.error(e); process.exit(1); });
"""

MEASURE = """() => [...document.querySelectorAll('[data-f]')].map(el => {
  const page = el.closest('.page'), pages = [...document.querySelectorAll('.page')];
  const pr = page.getBoundingClientRect(), r = el.getBoundingClientRect(), k = 0.75;   // CSS px -> pt
  return { name: el.dataset.f, page: pages.indexOf(page), x: (r.left - pr.left) * k, y: (r.top - pr.top) * k,
           w: r.width * k, h: r.height * k, cb: el.hasAttribute('data-cb'), ml: el.hasAttribute('data-ml'),
           fs: +(el.dataset.fs || 10) };
})"""


def build_pdfs(strings):
    from playwright.sync_api import sync_playwright
    E = env()
    year = datetime.date.today().year
    out_dir = ROOT / "build" / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    (ROOT / "pdf").mkdir(exist_ok=True)
    pdflib = str(ROOT / "vendor" / "pdf-lib.min.js")
    with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.emulate_media(media="print")
        for lang in LANGS:
            t, T = STRINGS[lang], strings[lang]
            html = E.get_template("print_worksheet.html").render(
                lang=lang, L=EX_LABELS[lang], T=T, title=t["ws_goal_title"], hint=t["ws_goal_hint"], author=AUTHOR,
                copyright=t["copyright"].format(year=year), assets=(SRC / "assets").as_uri() + "/")
            src_html = out_dir / f"worksheet-{lang}.html"
            src_html.write_text(html, encoding="utf-8")
            pg.goto(src_html.as_uri())
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(200)
            fields = pg.evaluate(MEASURE)
            raw = Path(tmp) / f"raw-{lang}.pdf"
            pg.pdf(path=str(raw), prefer_css_page_size=True, print_background=True)
            dst = SRC / "assets" / f"worksheet-{lang}.pdf"
            spec = dict(src=str(raw), out=str(dst), fields=fields, title=t["ws_goal_title"], author=AUTHOR,
                        subject=t["ws_goal_hint"], lang=lang, date=f"{year}-01-01T00:00:00Z")
            spec_file = Path(tmp) / f"spec-{lang}.json"
            spec_file.write_text(json.dumps(spec), encoding="utf-8")
            js = Path(tmp) / "fields.js"
            js.write_text(NODE, encoding="utf-8")
            subprocess.run(["node", str(js), pdflib, str(spec_file)], check=True)
            shutil.copy(dst, ROOT / "pdf" / f"goal-worksheet-{lang}.pdf")
            print(dst.relative_to(ROOT), dst.stat().st_size // 1024, "KB,", len(fields), "fields")
        b.close()


if __name__ == "__main__":
    build_pdfs(sync_strings())
