#!/usr/bin/env python3
"""Build The Wheel and the Arrow app (GitHub Pages serves the repository root).

Sources:  content/  (booklet-<lang>.md, example-<lang>.yml, bible.md)
          src/      (templates, assets, tools' i18n, legal.yml, sw.js, manifest)
Output:   en/ de/ af/ (pages), assets/, index.html + goals.html + whole-life.html (routers),
          sw.js, manifest.webmanifest, .nojekyll.  pdf/ is written by build/pdf.py.

    python3 build/build.py
"""
import datetime
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "build"))
from strings import LANGS, STRINGS  # noqa: E402

SRC, CONTENT = ROOT / "src", ROOT / "content"
OUT_DIRS = LANGS + ["assets"]
TOOLS = {  # tool -> (file in each language folder, extra scripts in assets/)
    "wheel": ("wheel.html", []),
    "goals": ("goals.html", ["vendor/pdf-lib.min.js"]),
    "plan": ("plan.html", []),
}
ICONS = {
    "booklet": '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7c4-1.5 7-1 11 1.5V27c-4-2.5-7-3-11-1.5zM27 7c-4-1.5-7-1-11 1.5V27c4-2.5 7-3 11-1.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    "wheel": '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 4v24M5.6 10l20.8 12M5.6 22l20.8-12" stroke="currentColor" stroke-width="1.3" opacity=".6"/><path d="M16 9l5 4 1 7-6 3-5-4 0-6z" fill="currentColor" opacity=".35"/></svg>',
    "goals": '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><circle cx="15" cy="17" r="11" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="17" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="17" r="1.8" fill="currentColor"/><path d="M15 17L28 4M28 4h-5M28 4v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    "plan": '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="4" width="20" height="24" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 11h10M11 16h10M11 21h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
}


def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


# ------------------------------------------------------------------ content
def parse_bible():
    """content/bible.md -> {chapter_no: {"ref": "...", lang: text}}"""
    out, cur = {}, None
    for line in (CONTENT / "bible.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"## (\d+) · .*? — (.+)$", line)
        if m:
            cur = int(m.group(1)); out[cur] = {"ref": m.group(2).strip()}
            continue
        m = re.match(r"- (en|de|af): (.+)$", line)
        if m and cur:
            out[cur][m.group(1)] = m.group(2).strip()
        if line.startswith("## Notes"):
            cur = None
    return out


BOOK_NAMES = {  # reference display per language
    "en": {"Philippians": "Philippians", "Galatians": "Galatians", "Romans": "Romans", "Luke": "Luke", "Proverbs": "Proverbs"},
    "de": {"Philippians": "Philipper", "Galatians": "Galater", "Romans": "Römer", "Luke": "Lukas", "Proverbs": "Sprüche"},
    "af": {"Philippians": "Filippense", "Galatians": "Galasiërs", "Romans": "Romeine", "Luke": "Lukas", "Proverbs": "Spreuke"},
}


def ref_for(ref, lang):
    book, rest = ref.rsplit(" ", 1)
    return f"{BOOK_NAMES[lang][book]} {rest}"


def small_caps(s):
    return re.sub(r"\b(LORD|HERRN|HERR|HERE)\b", lambda m: f'<span class="sc">{m.group(1).capitalize()}</span>', s)


def booklet_source(lang):
    p = CONTENT / f"booklet-{lang}.md"
    fallback = not p.exists()
    if fallback:
        p = CONTENT / "booklet-en.md"
    raw = p.read_text(encoding="utf-8")
    _, fm, body = raw.split("---", 2)
    return yaml.safe_load(fm), body, fallback, ("en" if fallback else lang)


def areas(lang):
    a = load_json(SRC / "i18n" / "areas.json")
    return [(i, *a[lang][i]) for i in a["ids"]]


def wheel_svg(lang, scores=None, size=320):
    """Static wheel diagram (six segments, rings 1-10) with area labels."""
    import math
    names = [n for _, n, _ in areas(lang)]
    cx = cy = size / 2
    R = size * 0.34
    parts = [f'<svg viewBox="0 0 {size} {size}" role="img" aria-label="{html.escape(", ".join(names))}">']
    for k in range(1, 11):
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{R*k/10:.1f}" fill="none" stroke="currentColor" stroke-opacity="{.5 if k == 10 else .15}" stroke-width="{1.4 if k == 10 else .8}"/>')
    pts = []
    for i, name in enumerate(names):
        ang = -math.pi / 2 + i * math.pi / 3
        x, y = cx + R * math.cos(ang), cy + R * math.sin(ang)
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="currentColor" stroke-opacity=".35"/>')
        lx, ly = cx + (R + 22) * math.cos(ang), cy + (R + 22) * math.sin(ang)
        anchor = "middle" if abs(math.cos(ang)) < .2 else ("start" if math.cos(ang) > 0 else "end")
        words = name.split(" & ")
        lines = [words[0] + " &amp;", words[1]] if len(words) == 2 else [html.escape(name)]
        dy0 = -6 if ly < cy - 5 else (6 if ly > cy + 5 else 0)
        parts.append(f'<text x="{lx:.1f}" y="{ly + dy0 - 5:.1f}" text-anchor="{anchor}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="currentColor">'
                     + "".join(f'<tspan x="{lx:.1f}" dy="{0 if j == 0 else 13}">{w}</tspan>' for j, w in enumerate(lines)) + "</text>")
        if scores:
            r = R * scores[i] / 10
            pts.append(f"{cx + r*math.cos(ang):.1f},{cy + r*math.sin(ang):.1f}")
    if pts:
        parts.append(f'<polygon points="{" ".join(pts)}" fill="var(--plot, #b5482e)" fill-opacity=".18" stroke="var(--plot, #b5482e)" stroke-width="2"/>')
        for p in pts:
            x, y = p.split(","); parts.append(f'<circle cx="{x}" cy="{y}" r="3.5" fill="var(--plot, #b5482e)"/>')
    parts.append(f'<text x="{cx}" y="{cy - 3}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="currentColor" opacity=".6">1</text>')
    parts.append("</svg>")
    return "".join(parts)


EX_LABELS = {
    "en": dict(area="Life area", started="Started", target="Target date", achieved="Achieved on", goal="The goal", why="Why it matters",
               gain="What I gain", avoid="What I avoid", obst="What could get in the way", handle="How I'll handle it", steps="Action steps",
               step="Action step", due="Due", rev="Reviewed", done="Done", who="Who should know", track="How I'll track progress",
               worth="Worth it?", q1="Does this fit what I value?", q2="Is the time, effort and cost worth it?", yes="Yes", no="No",
               rem="Encouraging reminder", pic="Picture success"),
    "de": dict(area="Lebensbereich", started="Begonnen", target="Zieldatum", achieved="Erreicht am", goal="Das Ziel", why="Warum es wichtig ist",
               gain="Was ich gewinne", avoid="Was ich vermeide", obst="Was dazwischenkommen könnte", handle="Wie ich damit umgehe", steps="Schritte",
               step="Schritt", due="Fällig", rev="Geprüft", done="Erledigt", who="Wer davon wissen sollte", track="Wie ich meinen Fortschritt verfolge",
               worth="Lohnt es sich?", q1="Passt es zu meinen Werten?", q2="Sind Zeit, Mühe und Kosten es wert?", yes="Ja", no="Nein",
               rem="Ermutigende Erinnerung", pic="Erfolg vor Augen"),
    "af": dict(area="Lewensarea", started="Begin", target="Teikendatum", achieved="Bereik op", goal="Die doelwit", why="Waarom dit saak maak",
               gain="Wat ek wen", avoid="Wat ek vermy", obst="Wat in die pad kan kom", handle="Hoe ek dit sal hanteer", steps="Aksiestappe",
               step="Aksiestap", due="Sperdatum", rev="Nagegaan", done="Klaar", who="Wie moet weet", track="Hoe ek my vordering sal volg",
               worth="Is dit die moeite werd?", q1="Pas dit by my waardes?", q2="Is die tyd, moeite en koste die moeite werd?", yes="Ja", no="Nee",
               rem="Bemoedigende herinnering", pic="Sien sukses voor jou"),
}


def example_html(lang):
    p = CONTENT / f"example-{lang}.yml"
    if not p.exists():
        p = CONTENT / "example-en.yml"
    e, L = yaml.safe_load(p.read_text(encoding="utf-8")), EX_LABELS[lang]
    esc = html.escape
    rows = "".join(f"<tr><td>{esc(a)}</td><td>{esc(b)}</td></tr>" for a, b in e["obstacles"])
    steps = "".join(f"<li>{esc(s)} <span class=\"meta\">· {L['due']}: {esc(d)} · {L['rev']}: {esc(r)} · {L['done']}: {esc(x)}</span></li>" for s, d, r, x in e["steps"])
    who = "".join(f"<li>{esc(w)}</li>" for w in e["who"])
    yn = lambda v: f"☑ {L['yes']}" if v == "yes" else f"☑ {L['no']}"
    return f"""<div class="ex">
<h4>{L['area']}</h4><p><strong>{esc(e['area'])}</strong> <span class="meta">· {L['started']}: {esc(str(e['started']))} · {L['target']}: {esc(str(e['target']))} · {L['achieved']}: {esc(str(e['achieved']))}</span></p>
<h4>{L['goal']}</h4><p class="goal">“{esc(e['goal'])}”</p>
<h4>{L['why']}</h4><dl><dt>{L['gain']}</dt><dd>{esc(e['gain'])}</dd><dt>{L['avoid']}</dt><dd>{esc(e['avoid'])}</dd></dl>
<div class="tbl-wrap"><table class="stack"><thead><tr><th>{L['obst']}</th><th>{L['handle']}</th></tr></thead><tbody>{rows}</tbody></table></div>
<h4>{L['steps']}</h4><ol>{steps}</ol>
<h4>{L['who']}</h4><ul>{who}</ul>
<h4>{L['track']}</h4><p>{esc(e['track'])}</p>
<h4>{L['worth']}</h4><p>{L['q1']} <strong>{yn(e['worth'][0])}</strong><br>{L['q2']} <strong>{yn(e['worth'][1])}</strong></p>
<h4>{L['rem']}</h4><p><em>“{esc(e['reminder'])}”</em></p>
<h4>{L['pic']}</h4><p>{esc(e['picture'])}</p>
</div>"""


def motto_html(n, lang, bible, cls="motto"):
    b = bible.get(n)
    if not b or lang not in b:
        return ""
    return f'<blockquote class="{cls}"><p>{small_caps(html.escape(b[lang]))}</p><cite>{ref_for(b["ref"], lang)}</cite></blockquote>'


def render_markdown(md_text):
    h = markdown.markdown(md_text, extensions=["tables", "sane_lists"])
    h = re.sub(r"<thead>\s*<tr>\s*(<th>\s*</th>\s*)+</tr>\s*</thead>", "", h)   # header-less layout tables
    h = h.replace("<table>", '<div class="tbl-wrap"><table class="stack">').replace("</table>", "</table></div>")
    return h


def chapters_for(lang, bible, mode="web"):
    fm, body, fallback, src_lang = booklet_source(lang)
    out = []
    for block in re.split(r"^# ", body, flags=re.M)[1:]:
        head, _, text = block.partition("\n")
        n, title = [x.strip() for x in head.split("|", 1)]
        n = int(n)
        text = text.replace("@verse " + str(n), f"\n\n@@VERSE{n}@@\n\n")
        text = text.replace("@wheel", "\n\n@@WHEEL@@\n\n").replace("@example", "\n\n@@EXAMPLE@@\n\n")
        text = re.sub(r"^## ", "### ", text, flags=re.M)
        h = render_markdown(text)
        h = h.replace(f"<p>@@VERSE{n}@@</p>", motto_html(n, lang, bible))
        caption = {"en": "The six areas, scored from 1 (centre) to 10 (rim).", "de": "Die sechs Bereiche, bewertet von 1 (Mitte) bis 10 (Rand).",
                   "af": "Die ses areas, met punte van 1 (middel) tot 10 (rand)."}[lang]
        h = h.replace("<p>@@WHEEL@@</p>", f'<figure class="wheel-fig">{wheel_svg(lang)}<figcaption>{caption}</figcaption></figure>')
        h = h.replace("<p>@@EXAMPLE@@</p>", example_html(lang))
        out.append({"n": n, "id": f"ch{n}", "title": title, "html": h})
    return fm, out, fallback


# ------------------------------------------------------------------ build
def env():
    e = Environment(loader=FileSystemLoader(str(SRC / "templates")), autoescape=False, trim_blocks=True, lstrip_blocks=True)
    return e


def clean():
    for d in OUT_DIRS:
        p = ROOT / d
        if p.exists():
            shutil.rmtree(p)
    for f in ["index.html", "goals.html", "whole-life.html", "sw.js", "manifest.webmanifest"]:
        (ROOT / f).unlink(missing_ok=True)


def tool_strings(tool, lang):
    p = SRC / "i18n" / f"{tool}.json"
    if not p.exists():
        return {}
    d = load_json(p)
    s = dict(d.get("en", {}))
    s.update(d.get(lang, {}))
    a = load_json(SRC / "i18n" / "areas.json")
    s["_areas"] = [[i, *a[lang][i]] for i in a["ids"]]
    s["_lang"] = lang
    return s


def build():
    clean()
    E = env()
    legal = yaml.safe_load((SRC / "legal" / "legal.yml").read_text(encoding="utf-8"))
    bible = parse_bible()
    year = datetime.date.today().year
    legal_date = {"de": "31. Oktober 2026", "en": "31 October 2026", "af": "31 Oktober 2026"}
    shutil.copytree(SRC / "assets", ROOT / "assets")
    if (ROOT / "vendor").exists():
        shutil.copytree(ROOT / "vendor", ROOT / "assets" / "vendor")
    (ROOT / ".nojekyll").write_text("")
    for lang in LANGS:
        t = STRINGS[lang]
        fm, chapters, fallback = chapters_for(lang, bible)
        nav = [("index.html", t["home"]), ("booklet.html", t["booklet"]), ("wheel.html", t["wheel"]),
               ("goals.html", t["goals"]), ("plan.html", t["plan"])]
        base = dict(lang=lang, t=t, langs=LANGS, strings=STRINGS, root="../", nav=nav, chapters=chapters,
                    copyright=t["copyright"].format(year=year), legal=legal, year=year, legal_date=legal_date[lang])
        (ROOT / lang).mkdir()

        def page(tpl, file, pg, **kw):
            ctx = dict(base, file=file, page=pg, **kw)
            ctx["app_json"] = json.dumps({"root": "../", "lang": lang, "langs": LANGS, "page": pg})
            (ROOT / lang / file).write_text(E.get_template(tpl).render(**ctx), encoding="utf-8")

        cards = [dict(href="booklet.html", icon=ICONS["booklet"], title=t["booklet"], sub=t["booklet_sub"]),
                 dict(href="wheel.html", icon=ICONS["wheel"], title=t["wheel"], sub=t["wheel_sub"]),
                 dict(href="goals.html", icon=ICONS["goals"], title=t["goals"], sub=t["goals_sub"]),
                 dict(href="plan.html", icon=ICONS["plan"], title=t["plan"], sub=t["plan_sub"])]
        page("home.html", "index.html", "home", cards=cards, motto=fm["motto"])
        page("booklet.html", "booklet.html", "booklet", bk=fm)
        page("about.html", "about.html", "about")
        page("legal.html", "legal.html", "legal")
        for tool, (file, scripts) in TOOLS.items():
            if not (SRC / "templates" / "tools" / f"{tool}.html").exists():
                continue
            T = tool_strings(tool, lang)
            page("tool.html", file, tool, tool=tool, T=T, T_json=json.dumps(T, ensure_ascii=False),
                 tool_title=T.get("title", t[tool]), tool_scripts=scripts)
        if fallback:
            print(f"  note: {lang} booklet not translated yet – English text used")
    # routers (root, and old addresses)
    for file, target in [("index.html", "index.html"), ("goals.html", "goals.html"), ("whole-life.html", "plan.html")]:
        ctx = dict(root="", langs=LANGS, strings=STRINGS, target=target,
                   app_json=json.dumps({"root": "", "langs": LANGS, "page": "router", "target": target}))
        (ROOT / file).write_text(E.get_template("router.html").render(**ctx), encoding="utf-8")
    shutil.copy(SRC / "manifest.webmanifest", ROOT / "manifest.webmanifest")
    write_service_worker()
    print("built", ", ".join(LANGS))


def write_service_worker():
    files = ["./", "index.html", "manifest.webmanifest"]
    for d in LANGS + ["assets"]:
        for p in sorted((ROOT / d).rglob("*")):
            if p.is_file():
                files.append(p.relative_to(ROOT).as_posix())
    pdf = ROOT / "pdf"
    if pdf.exists():
        files += [p.relative_to(ROOT).as_posix() for p in sorted(pdf.glob("*.pdf"))]
    h = hashlib.sha256()
    for f in files[2:]:
        p = ROOT / f
        if p.is_file():
            h.update(f.encode()); h.update(p.read_bytes())
    sw = (SRC / "sw.js").read_text(encoding="utf-8")
    sw = sw.replace("__VERSION__", h.hexdigest()[:12]).replace("__FILES__", json.dumps(files, indent=0))
    (ROOT / "sw.js").write_text(sw, encoding="utf-8")


if __name__ == "__main__":
    build()
