#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Exports the tree to GEDCOM 5.5.1 (UTF-8), to import it into Gramps, MyHeritage, etc.

Usage: uv run scripts/export_gedcom.py [-o build/arbre.ged] [--public]

With --public, what the public version of the web shows (privacy.py): the living only as «Persona viva», with their
links; the deceased without research notes nor biographies that name the living; and only the public documents.
"""

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

from arbre import CONFIG, ROOT, families, i18n, load_people, load_sources, parse_date, strip_refs_block, sub_links
from privacy import public_view

MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split()
QUALIFIER = {"exact": "", "about": "ABT ", "before": "BEF ", "after": "AFT ", "doubtful": "EST "}
# Placeholder of the person template (templates/persona.md) for a biography still empty
EMPTY_BIOGRAPHY = "_Sin datos todavía._"


def ged_date(value):
    try:
        d = parse_date(value)
    except ValueError:
        return None
    if not d or d.qualifier == "unknown":
        return None
    parts = [str(d.year)]
    if d.month:
        parts.insert(0, MONTHS[d.month - 1])
        if d.day:
            parts.insert(0, str(d.day))
    return QUALIFIER[d.qualifier] + " ".join(parts)


def text_lines(level, tag, text):
    """Emits a long text with CONT (line breaks) and CONC (lines longer than 200 characters)."""
    out = []
    for i, line in enumerate(text.split("\n")):
        chunks = [line[j:j + 200] for j in range(0, len(line), 200)] or [""]
        for k, chunk in enumerate(chunks):
            if i == 0 and k == 0:
                out.append(f"{level} {tag} {chunk}".rstrip())
            else:
                out.append(f"{level + 1} {'CONC' if k else 'CONT'} {chunk}".rstrip())
    return out


def plain(md, people):
    """Markdown -> plain text: replaces [[slug]] with the name and removes the formatting."""
    def repl(name, label, href):
        if label:
            return label
        return people[name].name if name in people else name
    s = re.sub(r"\A# .*\n", "", strip_refs_block(md))  # the title is already the NAME
    s = s.replace(EMPTY_BIOGRAPHY, "")
    # removes the «## …» sections left empty
    s = re.sub(r"^## [^\n]*\n\s*(?=^## |\Z)", "", s, flags=re.M)
    s = sub_links(s, repl)
    s = re.sub(r"^#+\s*", "", s, flags=re.M)
    s = re.sub(r"\*\*?([^*]+)\*\*?", r"\1", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=str(ROOT / "build" / "arbre.ged"))
    ap.add_argument("--public", action="store_true", help="only what the public version of the web shows")
    args = ap.parse_args(argv)

    people, errors = load_people()
    if errors:
        sys.exit("Some files have errors; run scripts/validate.py")
    sources = load_sources()
    fams = families(people)
    view = public_view(people, sources, CONFIG.main) if args.public else None
    living = view.living if view else {}
    shown = sorted(view.public_docs if view else sources)

    # In the public version the living go by their opaque id, so that no order follows their names
    order = sorted(people, key=view.public_id if view else None)
    if view:
        fams.sort(key=lambda f: [view.public_id(x) if x else "" for x in (f["husb"], f["wife"], *f["children"])])
    ixref = {slug: f"I{i}" for i, slug in enumerate(order, 1)}
    sxref = {sid: f"S{i}" for i, sid in enumerate(shown, 1)}
    fxref = [f"F{i}" for i in range(1, len(fams) + 1)]
    famc, fams_of = {}, {}
    for fx, f in zip(fxref, fams):
        for c in f["children"]:
            famc.setdefault(c, []).append(fx)
        for s in (f["husb"], f["wife"]):
            if s:
                fams_of.setdefault(s, []).append(fx)
    conf_of = {slug: (p.meta.get("parents_confidence") or "").upper() for slug, p in people.items()}

    out = ["0 HEAD", "1 SOUR arbre", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED",
           "1 CHAR UTF-8", f"1 DATE {ged_date(dt.date.today())}"]

    for slug in order:
        p = people[slug]
        m = p.meta
        out.append(f"0 @{ixref[slug]}@ INDI")
        if slug in living:
            out += [f"1 NAME {i18n.LIVING_PERSON_NAME}", "1 _LIVING Y"]
            out += [f"1 FAMC @{fx}@" for fx in famc.get(slug, [])] + [f"1 FAMS @{fx}@" for fx in fams_of.get(slug, [])]
            continue
        given = m.get("given_name") or ""
        surn = m.get("surnames") or ""
        out.append(f"1 NAME {given} /{surn}/".replace("  ", " ").strip())
        if given:
            out.append(f"2 GIVN {given}")
        if surn:
            out.append(f"2 SURN {surn}")
        for alias in m.get("aliases") or []:
            out.append(f"1 NAME {alias}")
            out.append("2 TYPE aka")
        if p.sex in ("M", "F"):
            out.append(f"1 SEX {p.sex}")
        for tag, dk, pk in (("BIRT", "born", "birth_place"), ("DEAT", "died", "death_place")):
            date, place = ged_date(m.get(dk)), m.get(pk)
            if date or place:
                out.append(f"1 {tag}")
                if date:
                    out.append(f"2 DATE {date}")
                if place:
                    out.append(f"2 PLAC {place}")
        if m.get("occupation"):
            out.append(f"1 OCCU {m['occupation']}")
        body = view.biography(slug, strip_refs_block(p.body)) if view else p.body
        note = plain(body, people) if body else ""
        if note:
            out += text_lines(1, "NOTE", note)
        for sid in p.sources:
            if sid in sxref:
                out.append(f"1 SOUR @{sxref[sid]}@")
        if p.living:
            out.append("1 _LIVING Y")
        for fx in famc.get(slug, []):
            out.append(f"1 FAMC @{fx}@")
            if conf_of[slug]:
                out.append(f"2 _CONF {conf_of[slug]}")
        for fx in fams_of.get(slug, []):
            out.append(f"1 FAMS @{fx}@")

    for fx, f in zip(fxref, fams):
        out.append(f"0 @{fx}@ FAM")
        if f["husb"]:
            out.append(f"1 HUSB @{ixref[f['husb']]}@")
        if f["wife"]:
            out.append(f"1 WIFE @{ixref[f['wife']]}@")
        mar = f["marriage"]
        # A marriage with a living person is a fact of their life too
        if mar and not any(s in living for s in (f["husb"], f["wife"])):
            date, place = ged_date(mar.get("date")), mar.get("place")
            if date or place:
                out.append("1 MARR")
                if date:
                    out.append(f"2 DATE {date}")
                if place:
                    out.append(f"2 PLAC {place}")
        if f["siblings_only"]:
            out.append(f"1 NOTE {i18n.GEDCOM_SIBLINGS_ONLY}")
        for c in f["children"]:
            out.append(f"1 CHIL @{ixref[c]}@")

    for sid in shown:
        meta, body = sources[sid]["meta"], sources[sid]["body"]
        out.append(f"0 @{sxref[sid]}@ SOUR")
        out.append(f"1 TITL {sid} — {meta.get('title') or sid}")
        if meta.get("origin") and not view:
            out.append(f"1 PUBL {meta['origin']}")
        text = plain(body, people)
        if text:
            out += text_lines(1, "NOTE", text)

    out.append("0 TRLR")
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{path}: {len(people)} people, {len(fams)} families, {len(shown)} sources")


if __name__ == "__main__":
    main(sys.argv[1:])
