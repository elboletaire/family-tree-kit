#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Checks the integrity of the tree. Exits with a non-zero code if there are errors.

Usage: uv run scripts/validate.py [--strict]   (--strict turns warnings into errors)
"""

import re
import sys

from arbre import (CONFIDENCE, CONFIG, CONFIG_PATH, PEOPLE_DIR, PERSON_KEYS, PLACES_PATH, PORTRAITS_DIR, RESEARCH_DIR,
                   REVIEW_DONE, REVIEW_VALUES, ROOT, SLUG_RE, SOURCE_CATEGORIES, SOURCE_KEYS, SOURCES_DIR,
                   TEXT_DATE_ISO, TEXT_DATE_LONG, all_note_names, find_text_dates, generated_files, load_people,
                   load_places, load_sources, long_text_date, parse_date, source_files, sub_links, unlink, used_places)

MIN_PARENT_AGE = 12
MAX_FATHER_AGE = 75
MAX_MOTHER_AGE = 55
# What `origin` quotes as it is (addresses, «file and folder names», `code`): its dates are not checked
LITERAL_RE = re.compile(r"https?://\S+|«[^»]*»|`[^`]*`")


def misdated(text, want):
    """The dates of a text not written in the form `want`, each with how it should be."""
    fix = long_text_date if want == TEXT_DATE_LONG else str
    return [f"{d.text} → {fix(d.iso)}" for d in find_text_dates(text) if d.form != want]


def main(argv):
    strict = "--strict" in argv
    people, load_errors = load_people()
    sources = load_sources()
    notes = all_note_names()
    errors, warnings = [], []

    def err(p, msg):
        errors.append(f"{p}: {msg}")

    def warn(p, msg):
        warnings.append(f"{p}: {msg}")

    for path, msg in load_errors:
        err(path.name, msg)
    # The data folders of families.yml (`paths`); the portraits one is optional
    for role, folder in (("people", PEOPLE_DIR), ("sources", SOURCES_DIR), ("research", RESEARCH_DIR)):
        if not folder.is_dir():
            err(CONFIG_PATH.name, f"paths.{role}: the folder «{folder.name}» does not exist (`make folders` creates it)")

    for slug, p in people.items():
        m = p.meta
        if not SLUG_RE.match(slug):
            err(slug, "the file name must be lowercase, without accents and with hyphens")
        for k in sorted(set(m) - PERSON_KEYS):
            err(slug, f"unknown field «{k}»")
        if not (m.get("given_name") or m.get("surnames")):
            err(slug, "missing given_name and surnames")
        if m.get("sex") not in ("M", "F", "U"):
            err(slug, "sex must be M, F or U")

        dates = {}
        for k in ("born", "died"):
            if m.get(k) is None:
                continue
            try:
                dates[k] = parse_date(m[k])
            except ValueError as e:
                err(slug, f"{k}: {e}")

        if p.living and m.get("died"):
            err(slug, "living: true but it has a death date")
        if m.get("living") is not None and not isinstance(m["living"], bool):
            err(slug, "living must be true or false")
        if m.get("birth_order") is not None and not isinstance(m["birth_order"], int):
            err(slug, "birth_order must be an integer")

        # Links
        for k in ("father", "mother"):
            if m.get(k) is None:
                continue
            target = unlink(m[k])
            if not target:
                err(slug, f"{k} must be a wikilink \"[[slug]]\"")
            elif target not in people:
                err(slug, f"{k} points to a missing person: {target}")
            elif target == slug:
                err(slug, f"{k} points to itself")
            else:
                want = "M" if k == "father" else "F"
                if people[target].sex not in (want, "U"):
                    err(slug, f"{k} {target} has sex {people[target].sex}")
        for k in ("spouses", "siblings", "sources"):
            v = m.get(k)
            if v is None:
                continue
            if not isinstance(v, list):
                err(slug, f"{k} must be a list")
                continue
            for item in v:
                target = unlink(item)
                if not target:
                    err(slug, f"{k}: {item!r} is not a wikilink")
                elif k == "sources" and target not in sources:
                    err(slug, f"missing source: {target}")
                elif k != "sources" and target not in people:
                    err(slug, f"{k}: missing person: {target}")

        # Confidence
        if p.father or p.mother:
            conf = m.get("parents_confidence")
            if conf not in CONFIDENCE:
                err(slug, f"parents_confidence must be one of {', '.join(CONFIDENCE)}")
            elif conf == "speculative":
                err(slug, "a speculative parentage is not recorded: remove father/mother and "
                          "explain it in «Notas de investigación»")
        elif m.get("parents_confidence"):
            warn(slug, "parents_confidence without father or mother")

        # Reciprocity
        for s in p.spouses:
            if s in people and slug not in people[s].spouses:
                err(slug, f"non-reciprocal spouse: {s} does not list them in spouses")
        for mar in m.get("marriages") or []:
            if not isinstance(mar, dict) or "spouse" not in mar:
                err(slug, "each marriages entry needs «spouse»")
                continue
            if mar["spouse"] not in p.spouses:
                err(slug, f"marriages mentions {mar['spouse']}, who is not in spouses")
            if mar.get("date") is not None:
                try:
                    parse_date(mar["date"])
                except ValueError as e:
                    err(slug, f"marriages: {e}")
            other = people.get(mar["spouse"])
            if other:
                om = other.marriage(slug)
                if om and (str(om.get("date")), om.get("place")) != (str(mar.get("date")), mar.get("place")):
                    err(slug, f"the marriage with {mar['spouse']} has different data in each note")
        for s in p.siblings:
            if s in people and slug not in people[s].siblings:
                warn(slug, f"non-reciprocal sibling: {s}")
        if p.siblings and (p.father or p.mother):
            warn(slug, "siblings is only needed when the parents are unknown")

        # Date consistency
        b, d = dates.get("born"), dates.get("died")
        if b and d and b.year and d.year and d.sort_key() < b.sort_key():
            err(slug, "dies before being born")
        if b and b.year:
            for k, max_age in (("father", MAX_FATHER_AGE), ("mother", MAX_MOTHER_AGE)):
                par = people.get(p.get_link(k))
                if not par:
                    continue
                pb, pd = par.date("born"), par.date("died")
                if pb and pb.year:
                    age = b.year - pb.year
                    if age < MIN_PARENT_AGE or age > max_age:
                        warn(slug, f"{k} {par.slug} would be {age} years old at the birth")
                if pd and pd.year and pd.qualifier == "exact":
                    gap = pd.year - b.year
                    if (k == "mother" and pd.sort_key() < b.sort_key()) or gap < -1:
                        err(slug, f"{k} {par.slug} dies before the birth")

        if m.get("photo") and not p.photo.is_file():
            err(slug, f"photo points to a missing file: {m['photo']}")
        elif m.get("photo") and not p.photo.resolve().is_relative_to(PORTRAITS_DIR.resolve()):
            warn(slug, f"photo outside the portraits folder ({PORTRAITS_DIR.name}/): {m['photo']}")

        # Warnings
        if not p.sources:
            warn(slug, "no sources")
        if not (p.father or p.mother or p.spouses or p.siblings or p.children):
            warn(slug, "isolated person (no parents, spouses, children or siblings)")
        def check_link(name, label, href):
            broken = not (p.path.parent / href).resolve().exists() if href else name not in notes
            if broken:
                warn(slug, f"broken link in the text: {href or f'[[{name}]]'}")
            return ""
        sub_links(p.body, check_link)

    # Links in the text of sources and research
    for folder in (SOURCES_DIR, RESEARCH_DIR):
        for path in sorted(folder.glob("*.md")):
            def check_doc_link(name, label, href, path=path):
                broken = not (path.parent / href).resolve().exists() if href else name not in notes
                if broken:
                    warn(f"{folder.name}/{path.name}", f"broken link in the text: {href or f'[[{name}]]'}")
                return ""
            sub_links(path.read_text(encoding="utf-8"), check_doc_link)

    # Sources and their originals
    referenced = set()
    for sid, src in sources.items():
        meta = src["meta"]
        where = f"{SOURCES_DIR.name}/{sid}.md"
        for k in sorted(set(meta) - SOURCE_KEYS):
            err(where, f"unknown field «{k}»")
        if meta.get("id") != sid:
            err(where, "the frontmatter id does not match the file name")
        if not str(meta.get("origin") or "").strip():
            err(where, "no origin: say how the document reached the tree (who handed it over, the shared folder and file, "
                       "the website, the message…)")
        if meta.get("category") and meta["category"] not in SOURCE_CATEGORIES:
            err(where, f"category must be one of {', '.join(SOURCE_CATEGORIES)}")
        if meta.get("review") is not None and meta["review"] not in REVIEW_VALUES:
            err(where, f"review must be one of {', '.join(REVIEW_VALUES)}")
        if meta.get("reviewed_by") and meta.get("review") != REVIEW_DONE:
            warn(where, f"reviewed_by without review: {REVIEW_DONE}")
        # Dates: long form in prose (origin), ISO in data fields. Only a warning, so that older trees keep validating
        if bad := misdated(LITERAL_RE.sub(" ", str(meta.get("origin") or "")), TEXT_DATE_LONG):
            warn(where, "origin: dates in prose go in long form: " + "; ".join(bad))
        for k in ("pages", "reviewed_by"):
            if bad := misdated(str(meta.get(k) or ""), TEXT_DATE_ISO):
                warn(where, f"{k}: dates go as YYYY-MM-DD: " + "; ".join(bad))
        for f in source_files(meta):
            if not f.is_file():
                err(where, f"missing file: {f.relative_to(SOURCES_DIR)}")
            referenced.add(f.resolve())
    for f in sorted(SOURCES_DIR.rglob("*")):
        if f.is_file() and f.parent != SOURCES_DIR and f.resolve() not in referenced:
            err(str(f.relative_to(ROOT)), "original without a note: add it to the `files` of some source")

    # Generated sections up to date
    if not load_errors:
        for path, expected in generated_files(people, sources).items():
            if not path.exists() or path.read_text(encoding="utf-8") != expected:
                warn(str(path.relative_to(ROOT)), "outdated references: run `make refs`")

    # families.yml: its shape is checked when loading it (arbre.load_config); here, that its people exist
    config = CONFIG_PATH.name
    if CONFIG.main not in people:
        err(config, f"main points to a missing person: {CONFIG.main}")
    for slug in CONFIG.share_image:
        if slug not in people:
            err(config, f"share_image names a missing person: {slug}")
    founders = {}
    for b in CONFIG.branches:
        if b.founder not in people:
            err(config, f"the founder of branch {b.key} does not exist: {b.founder}")
        elif b.founder in founders:
            err(config, f"{b.founder} founds two branches: {founders[b.founder]} and {b.key}")
        founders.setdefault(b.founder, b.key)

    # places.yml: the map's coordinates. A place without them is only a warning (the web is built anyway)
    places, place_errors = load_places()
    for e in place_errors:
        err(PLACES_PATH.name, e)
    if not place_errors:
        for place in sorted(used_places(people, sources)):
            entry = places.get(place)
            if entry is None:
                warn(PLACES_PATH.name, f"«{place}» has no entry: run `make places`")
            elif not entry:
                warn(PLACES_PATH.name, f"«{place}» was not found: add lat/lon by hand, or skip: true")

    # Cycles
    def has_cycle(start):
        stack, seen = [start], set()
        while stack:
            cur = stack.pop()
            for par in (people[cur].father, people[cur].mother):
                if par == start:
                    return True
                if par in people and par not in seen:
                    seen.add(par)
                    stack.append(par)
        return False

    for slug in people:
        if has_cycle(slug):
            err(slug, "cycle: is their own ancestor")

    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    print(f"\n{len(people)} people, {len(sources)} sources, "
          f"{len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors or (strict and warnings) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
