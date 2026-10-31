#!/usr/bin/env python3
"""Render build/out/*.html (written by build.py) to pdf/: booklet (A5), slides (16:9), leader's notes (A4).
Run build.py first, and build.py again afterwards so the service worker lists the new PDFs."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "out"
JOBS = [("booklet", "wheel-and-arrow-{l}.pdf"), ("slides", "wheel-and-arrow-slides-{l}.pdf"), ("notes", "wheel-and-arrow-notes-{l}.pdf")]

(ROOT / "pdf").mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.emulate_media(media="print")
    for lang in ("de", "en", "af"):
        for src, name in JOBS:
            f = OUT / f"{src}-{lang}.html"
            if not f.exists():
                continue
            pg.goto(f.as_uri())
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(300)
            dst = ROOT / "pdf" / name.format(l=lang)
            pg.pdf(path=str(dst), prefer_css_page_size=True, print_background=True)
            print(dst.relative_to(ROOT), dst.stat().st_size // 1024, "KB")
    b.close()
