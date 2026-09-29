#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Finds the coordinates of the tree's places with OpenStreetMap's Nominatim and adds them to places.yml, which the
web's map reads (scripts/build_site.py).

Only the places that are not in places.yml yet are looked up, one request per second at most; what was already there
(and whatever was corrected by hand) is not touched: the new entries are appended at the end. Without network it
says so and leaves the file as it was, so the web is generated anyway with the places it already has.

A place is written as free text («Cangas (Pontevedra)», «Iglesia de San Pedro, Teruel», «Tudela [?]»): the doubt
marks are removed and, if nothing is found, simpler variants are tried (see `variants`). Only towns and
administrative areas are accepted, not buildings or streets. The results have to be reviewed by hand: small villages
and homonyms (the comment after each entry says what was found).

Usage: uv run scripts/geocode.py [--dry-run]
Set NOMINATIM_EMAIL to send a contact address with the requests, as Nominatim's usage policy asks for bulk use.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from arbre import DATE_ABOUT, PLACES_PATH, ROOT, i18n, load_people, load_places, load_sources, used_places

NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "arbre-family-tree/1.0 (places.yml geocoding for a family history site)"
MIN_INTERVAL = 1.1  # seconds between requests (the policy allows one per second)
# What a place can be: settlements and administrative areas (not churches, streets or buildings)
ACCEPTED = {"place", "boundary"}

HEADER = """\
# Coordinates of the tree's places (birth_place, death_place, the place of the marriages and of the sources), exactly
# as they are written in the notes. `make places` (scripts/geocode.py, with OpenStreetMap's Nominatim) appends the
# places that are not here yet; `make validate` warns about those without coordinates. It can be edited by hand:
#   "Place as written": {lat: 40.9701, lon: -5.6635, name: Salamanca}   name: its label on the map
#   "Place as written": {skip: true}                                 not shown on the map
#   "Place as written": {}                                           not found: add lat/lon by hand, or skip
# To look a place up again, delete its line. The comment after each entry is what Nominatim found.
"""

DOUBT_RE = re.compile(r"\[\?\]|[¿?]")
ABOUT_RE = re.compile(r"^\s*" + re.escape(DATE_ABOUT.strip()) + r"\s*", re.I)
PAREN_RE = re.compile(r"\s*\(([^)]*)\)")
# Several places in one text: «A / B», «A y B»
ALTERNATIVES_RE = re.compile(r"\s+/\s+|\s+" + re.escape(i18n.PLACE_AND) + r"\s+")


def clean(text):
    """The text without doubt marks («?», «[?]») nor «c.», and with its spaces tidied."""
    text = ABOUT_RE.sub("", DOUBT_RE.sub("", text))
    return re.sub(r"\s+", " ", text).strip(" ,;")


def variants(text):
    """Queries to try, from the most precise to the most general.

    «Cangas (Pontevedra)» → «Cangas, Pontevedra», «Cangas»; «Iglesia de San Pedro, Teruel» → …, «Teruel»;
    «Cuenca y Albacete» → «Cuenca». A text that is only a remark in brackets («? (parque con estanque)»)
    has no place: no variants.
    """
    text = clean(text)
    if not text or text.startswith("("):
        return []
    out = []

    def add(q):
        q = q.strip(" ,;")
        if q and q not in out:
            out.append(q)

    add(PAREN_RE.sub(lambda m: ", " + m.group(1), text))   # the brackets as context
    bare = PAREN_RE.sub("", text)
    add(bare)
    first = ALTERNATIVES_RE.split(bare)[0]
    add(first)
    parts = [p.strip() for p in first.split(",") if p.strip()]
    for i in range(1, len(parts)):                          # without what precedes: a church, a parish, a street…
        add(", ".join(parts[i:]))
    for i in range(len(parts) - 1, 0, -1):                  # without what follows: several places in a list
        add(", ".join(parts[:i]))
    return out


class Nominatim:
    def __init__(self):
        self.last = 0.0
        self.email = os.environ.get("NOMINATIM_EMAIL")

    def search(self, query):
        """Results of a query, the most important first. Raises OSError without network."""
        wait = self.last + MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        params = {"q": query, "format": "json", "limit": 5, "accept-language": i18n.GEOCODE_LANGUAGE}
        if self.email:
            params["email"] = self.email
        req = urllib.request.Request(f"{NOMINATIM}?{urllib.parse.urlencode(params)}", headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)
        finally:
            self.last = time.monotonic()


def best(results):
    """The first settlement or administrative area, or None. A municipality (boundary) is placed at its town (the
    place of the same name), not at the centre of its territory."""
    r = next((r for r in results if r.get("class") in ACCEPTED), None)
    if r and r.get("class") == "boundary":
        r = next((t for t in results if t.get("class") == "place" and t.get("name") == r.get("name")
                  and inside(t, r["boundingbox"])), r)
    return r


def inside(r, box):
    """Is the result inside the bounding box [south, north, west, east] (Nominatim's `boundingbox`)?"""
    s, n, w, e = map(float, box)
    return s <= float(r["lat"]) <= n and w <= float(r["lon"]) <= e


def geocode(place, api):
    """(entry, what was found) of a place; the entry is {} if nothing is found."""
    queries = variants(place)
    if not queries:
        return {"skip": True}, "no concrete place"
    for q in queries:
        r = best(api.search(q))
        if r:
            name = r.get("name") or r["display_name"].split(",")[0]
            entry = {"lat": round(float(r["lat"]), 5), "lon": round(float(r["lon"]), 5), "name": name}
            return entry, f"{r['display_name']} ({r.get('type')}; searched «{q}»)"
    return {}, f"not found (tried: {' | '.join(queries)})"


def line(place, entry, note):
    """One entry of places.yml, in a single line, with what was found as a comment."""
    fields = ", ".join(f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in entry.items())
    return f"{json.dumps(place, ensure_ascii=False)}: {{{fields}}}  # {note}\n"


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="only list the places that would be looked up")
    args = ap.parse_args(argv)
    people, _ = load_people()
    known, errors = load_places()
    if errors:
        sys.exit(f"{PLACES_PATH.name}: " + "; ".join(errors))
    missing = sorted(set(used_places(people, load_sources())) - set(known))
    if not missing:
        print(f"{PLACES_PATH.name}: every place has an entry")
        return 0
    if args.dry_run:
        print("\n".join(missing))
        return 0

    api, found = Nominatim(), 0
    if not PLACES_PATH.exists():
        PLACES_PATH.write_text(HEADER, encoding="utf-8")
    for n, place in enumerate(missing, 1):
        try:
            entry, note = geocode(place, api)
        except (OSError, ValueError) as e:  # without network (or an odd answer): what is known is kept
            print(f"Nominatim is not reachable ({e}); {len(missing) - n + 1} places left without coordinates",
                  file=sys.stderr)
            break
        found += "lat" in entry
        print(f"[{n}/{len(missing)}] {place} → {note}", flush=True)
        with PLACES_PATH.open("a", encoding="utf-8") as f:
            f.write(line(place, entry, note))
    print(f"{PLACES_PATH.relative_to(ROOT)}: {found} of {len(missing)} new places located")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
