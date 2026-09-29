#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml", "markdown"]
# ///
"""Turns a note of the repository into a document to read or print outside it.

Links to people are replaced by their name and links to sources by their code. At the end comes the list of cited
documents (with the file and pages they come from). Writes HTML and, if Chromium or Chrome is installed, also PDF.

With `--family <key>` (one of families.yml) only that family's sections are included, besides «General» and
«Afecta a varias familias»; by default, the family marked `default` in families.yml. With `--family all`, the
whole document. `--familia` and `todo` are the former names, still accepted.

The note is a path, or the name of a document of the research folder (`paths.research` in families.yml).

Usage: uv run scripts/report.py [incoherencias] [--family <key>|all] [-o build/incoherencias]
"""

import argparse
import html
import re
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

from arbre import (ALL, ALL_LEGACY, DEFAULT_FAMILY, FAMILIES, FAMILY_TITLE, GENERAL, RESEARCH_DIR, ROOT, SEVERAL, Date,
                   family_sections, i18n, load_people, load_sources, parse_date, sub_links)

BROWSERS = ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable")

CSS = """
@page { size: A4; margin: 2cm 2.2cm; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.5;
       color: #222; max-width: 17cm; margin: 2rem auto; padding: 0 1rem; }
h1 { font-size: 20pt; margin: 0 0 .6em; }
h2 { font-size: 14pt; margin: 1.6em 0 .5em; border-bottom: 1px solid #bbb; padding-bottom: .15em;
     break-after: avoid; }
ul { padding-left: 1.4em; }
li { margin: .45em 0; break-inside: avoid; }
li.task { list-style: none; margin-left: -1.4em; }
li.task::before { content: "☐"; display: inline-block; width: 1.4em; }
.sources dt { font-weight: bold; margin-top: .5em; }
.sources dd { margin-left: 1.4em; }
@media print { body { margin: 0; max-width: none; padding: 0; } }
"""


def local_date(value):
    """Date as dd/mm/yyyy, keeping «c.», «antes de», etc."""
    try:
        d = parse_date(value)
    except ValueError:
        return str(value)
    if not d or not d.year:
        return str(value)
    iso = str(Date("exact", d.year, d.month, d.day))
    local = "/".join(reversed(iso.split("-")))
    return str(d).replace(iso, local)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("note", nargs="?", default="incoherencias")
    ap.add_argument("--family", "--familia", choices=(*FAMILIES, ALL, ALL_LEGACY), default=DEFAULT_FAMILY,
                    help=f"only the sections of one family (default: {DEFAULT_FAMILY}); {ALL}: the whole document")
    ap.add_argument("-o", "--output",
                    help="output path without extension (default: build/<note>[-<family>])")
    args = ap.parse_args(argv)
    family = ALL if args.family == ALL_LEGACY else args.family

    src = (ROOT / args.note).resolve()
    if not src.is_file():
        src = RESEARCH_DIR / f"{Path(args.note).stem}.md"
    people, _ = load_people()
    sources = load_sources()
    cited = []

    def repl(name, label, href):
        if name in sources:
            if name not in cited:
                cited.append(name)
            return name
        if name in people:
            return people[name].name
        return label or name

    text = src.read_text(encoding="utf-8")
    if family != ALL:
        keep = (None, family, SEVERAL, GENERAL)
        text = "".join(chunk for fam, chunk in family_sections(text) if fam in keep)
        text = re.sub(r"(?m)\A# (.+)$", lambda m: f"# {m.group(1)} · {FAMILY_TITLE[family]}", text)
    text = sub_links(text, repl)
    body = markdown.markdown(text)
    body = re.sub(r"<li>\[[ xX]\]\s*", '<li class="task">', body)

    if cited:
        items = []
        for sid in sorted(cited):
            meta = sources[sid]["meta"]
            detail = ", ".join(x for x in (meta.get("type"), meta.get("date") and local_date(meta["date"])) if x)
            where = ", ".join(str(x) for x in (meta.get("origin"), meta.get("pages")) if x)
            lines = [html.escape(detail)]
            if meta.get("subject"):
                lines.append(i18n.REPORT_ABOUT.format(html.escape(str(meta["subject"]))))
            if where:
                lines.append(i18n.REPORT_WHERE.format(html.escape(where)))
            items.append(f"<dt>{sid} — {html.escape(str(meta.get('title') or ''))}</dt>"
                         f"<dd>{'<br>'.join(lines)}</dd>")
        body += f'<h2>{i18n.REPORT_CITED_DOCS}</h2><dl class="sources">{"".join(items)}</dl>'

    title = re.search(r"<h1>(.*?)</h1>", body)
    title = re.sub("<[^>]+>", "", title.group(1)) if title else src.stem
    page = (f'<!doctype html><html lang="{i18n.REPORT_LANG}"><head><meta charset="utf-8"><title>{title}</title>'
            f"<style>{CSS}</style></head><body>{body}</body></html>")

    # The output keeps its published names: build/<note>-<family>, or build/<note> for the whole document
    stem = src.stem if family == ALL else f"{src.stem}-{family}"
    out = Path(args.output) if args.output else ROOT / "build" / stem
    out.parent.mkdir(parents=True, exist_ok=True)
    html_path = out.with_suffix(".html")
    html_path.write_text(page, encoding="utf-8")
    print(html_path)

    browser = next((b for b in map(shutil.which, BROWSERS) if b), None)
    if not browser:
        print("Chromium/Chrome not found: only the HTML is generated (it can be printed to PDF from the browser).",
              file=sys.stderr)
        return
    pdf_path = out.with_suffix(".pdf")
    subprocess.run([browser, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}", html_path.resolve().as_uri()],
                   check=True, capture_output=True)
    print(pdf_path)


if __name__ == "__main__":
    main(sys.argv[1:])
