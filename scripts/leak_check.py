#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml", "pillow"]
# ///
"""Leak check of the public version: looks for the data of the living people and the names of the private documents in
every file of it (text, file names and image metadata), without accents or capitals. build_site.py runs it before
writing build/public, and stops if it finds anything; by hand it also checks other files (the public GEDCOM).

What it looks for, of each person treated as living (privacy.py):
- their name: full, given name with their first surnames, the aliases of more than one word and the slug;
- their dates of birth, death and marriage with at least the month, in several forms (1952-12-19, 19 de diciembre de
  1952, 19/12/1952);
- their places and occupation, and the dates and places of their marriages, and the labels of those places on the map
  (places.yml).
And of each private document, its title (of three words or more) and the names of its originals. Besides, the places of
the map (DATA.places) can only be those of the facts the public version shows.

A value that is also that of a deceased person or a public document (a namesake grandfather, a town where both were
born, the same date) cannot be told apart: it is left out, and listed as excluded.

Usage: uv run scripts/leak_check.py [paths…]   (by default build/public)
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image

from arbre import CONFIG, ROOT, load_people, load_places, load_sources, source_files
from privacy import date_needles, public_view
from textsearch import norm, readable

TEXT_EXT = {".html", ".htm", ".json", ".js", ".mjs", ".css", ".txt", ".ged", ".svg", ".xml", ".md", ".csv"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MIN_TITLE_WORDS = 3
MIN_FILE_STEM = 5


def needles(view):
    """([(needle, what it is)], [(needle, what it is, why it is excluded)])."""
    people, sources = view.people, view.sources
    found, excluded = {}, []

    def public_values():
        out = set()
        for s, p in people.items():
            if s in view.living:
                continue
            for k in ("birth_place", "death_place", "occupation"):
                if p.meta.get(k):
                    out.add(norm(p.meta[k]).strip())
            for k in ("born", "died"):
                out |= {norm(x).strip() for x in date_needles(p.meta.get(k))}
            for m in p.meta.get("marriages") or []:
                if isinstance(m, dict) and m.get("spouse") not in view.living:
                    out |= {norm(x).strip() for x in date_needles(m.get("date"))}
                    if m.get("place"):
                        out.add(norm(m["place"]).strip())
        for sid in view.public_docs:
            meta = sources[sid]["meta"]
            out |= {norm(x).strip() for x in date_needles(meta.get("date"))}
            for k in ("place", "title", "issuer"):
                if meta.get(k):
                    out.add(norm(meta[k]).strip())
        return out

    shown = public_values()

    def add(value, what):
        n = norm(value).strip()
        if not n:
            return
        if n in shown:
            excluded.append((value, what, "also a deceased person's or a public document's"))
        else:
            found.setdefault(n, what)

    # Labels of the places on the map: those of the public places are public too
    located = load_places()[0]
    label = lambda place: (located.get(place) or {}).get("name")  # noqa: E731
    shown |= {norm(x).strip() for x in map(label, view.public_places()) if x}

    for slug in sorted(view.living):
        p, who = people[slug], view.public_id(slug)
        for n in sorted(view.needles[slug]):
            add(n, f"name of {who}")
        for k in ("born", "died"):
            for d in sorted(date_needles(p.meta.get(k))):
                add(d, f"date ({k}) of {who}")
        for k in ("birth_place", "death_place", "occupation"):
            if p.meta.get(k):
                add(p.meta[k], f"{k} of {who}")
        for m in p.meta.get("marriages") or []:
            if isinstance(m, dict):
                for d in sorted(date_needles(m.get("date"))):
                    add(d, f"marriage date of {who}")
                if m.get("place"):
                    add(m["place"], f"marriage place of {who}")
        places = [p.meta.get("birth_place"), p.meta.get("death_place")]
        places += [m.get("place") for m in p.meta.get("marriages") or [] if isinstance(m, dict)]
        for place in places:
            if place and label(place):
                add(label(place), f"label on the map of a place of {who}")
    for form, (living, deceased) in sorted(view.shared_names.items()):
        excluded.append((form, f"name of {view.public_id(living)}", f"also that of {deceased}, deceased"))

    public_titles = {norm(sources[s]["meta"].get("title") or "").strip() for s in view.public_docs}
    for sid, reason in sorted(view.docs.items()):
        if reason is None:
            continue
        title = str(sources[sid]["meta"].get("title") or "")
        if len(norm(title).split()) >= MIN_TITLE_WORDS:
            if norm(title).strip() in public_titles:
                excluded.append((title, f"title of {sid}", "also a public document's"))
            else:
                found.setdefault(norm(title).strip(), f"title of the private document {sid}")
    # The originals of the private documents: their names may carry names
    for sid in sorted(s for s, reason in view.docs.items() if reason):
        for f in source_files(sources[sid]["meta"]):
            if len(f.stem) >= MIN_FILE_STEM and any(c.isalpha() for c in f.stem):
                found.setdefault(norm(f.name).strip(), f"original of {sid}")
    return sorted(found.items()), excluded


def image_metadata(path):
    """Text of the metadata of an image (EXIF, comments, XMP…)."""
    try:
        with Image.open(path) as img:
            parts = [f"{k} {v}" for k, v in img.info.items() if isinstance(v, (str, bytes))]
            parts += [str(v) for v in img.getexif().values()]
    except OSError as e:
        return f"unreadable image: {e}"
    return " ".join(p.decode(errors="replace") if isinstance(p, bytes) else p for p in parts)


TAG_RE = re.compile(r"<[^<>]*>")
def texts(paths):
    """(file, what, normalized text) of every file, file name and image metadata under `paths`."""
    for base in paths:
        base = Path(base)
        files = sorted(x for x in base.rglob("*") if x.is_file()) if base.is_dir() else [base]
        for f in files:
            rel = f.relative_to(base).as_posix() if base.is_dir() else f.name
            yield f, "name", norm(rel)
            ext = f.suffix.lower()
            if ext in TEXT_EXT:
                text = readable(f.read_text(encoding="utf-8", errors="replace"))
                yield f, "text", norm(text)
                # And without the tags, which split a name marked up in the middle («Marc <em>Ferrer</em>»)
                if "<" in text:
                    yield f, "text without tags", norm(TAG_RE.sub(" ", text))
            elif ext in IMAGE_EXT:
                yield f, "metadata", norm(image_metadata(f))


def page_data(path):
    """The DATA embedded in a page of the web, or None."""
    text = path.read_text(encoding="utf-8", errors="replace")
    start = text.find("const DATA = ")
    if start < 0:
        return None
    start += len("const DATA = ")
    try:
        return json.loads(text[start:text.index(";</script>", start)])
    except ValueError:
        return None


def check(paths, view):
    """([(file, where, needle, what it is)], excluded) of the files in `paths` (a folder or a list of them)."""
    paths = [paths] if isinstance(paths, (str, Path)) else list(paths)
    wanted, excluded = needles(view)
    public_places = view.public_places()
    found = []
    for f, where, text in texts(paths):
        for n, what in wanted:
            if f" {n} " in text:
                found.append((f, where, n, what))
        if where == "text" and f.suffix.lower() in (".html", ".htm"):
            data = page_data(f) or {}
            found += [(f, "DATA.places", place, "a place of no public fact")
                      for place in sorted(set(data.get("places") or {}) - public_places)]
    return found, excluded


def report(found, excluded):
    grouped = {}
    for value, what, why in excluded:
        grouped.setdefault((value, why), []).append(what)
    for (value, why), whats in grouped.items():
        print(f"leak check: excluded «{value}» ({why}): {', '.join(dict.fromkeys(whats))}")
    for f, where, n, what in found:
        print(f"LEAK: {f} ({where}): «{n}» — {what}", file=sys.stderr)
    print(f"leak check: {len(found)} leaks, {len(excluded)} values excluded")


def main(argv):
    paths = argv or [str(ROOT / "build" / "public")]
    if missing := [p for p in paths if not Path(p).exists()]:
        sys.exit(f"it does not exist: {', '.join(missing)}")
    people, errors = load_people()
    if errors:
        sys.exit("Some files have errors; run scripts/validate.py")
    view = public_view(people, load_sources(), CONFIG.main)
    found, excluded = check(paths, view)
    report(found, excluded)
    if found:
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
