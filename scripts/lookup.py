#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Everything the tree knows about a person, a source or a branch, in one call, read from the notes as they are now
(no index to keep up to date). For agents: it replaces the rounds of grep and reading whole notes.

Each argument is one query:

- a source id (`F012`): its fields, files, the people who cite it and the research items (pendientes,
  incoherencias, descartados) that mention it;
- `rama/<key>`: the people of the branch, one line each, and the research items of its sections, one line each;
- a slug or a name (without accents or capitals, any part of the given name, surnames or aliases): the person's card
  (dates, places, parents, spouses, children, siblings, sources and the research items about them); with several
  matches, the list of candidates;
- anything else, or with `--text`: the lines of the notes (people, sources and research) that contain it, by note.

The cards are short by default: relatives by slug, source ids, one line per research item. Each part can be widened:

Usage: uv run scripts/lookup.py [--family] [--sources] [--links] [--items] [--full] [--body] [--text] [--all]
                                QUERY [QUERY...]
  --family   relatives with their names and dates, and the grandparents
  --sources  the title, date and state of each source; in a source's card, all its fields and its files
  --links    the notes that link or name the person or source
  --items    the research items in full, with their section
  --full     all of the above
  --body     also print the note's body (biography and research notes, or the transcription)
  --text  search the text of the notes, not people
  --all   a card for every matching person, however many
"""

import argparse
import re
import sys

from arbre import (BRANCH_TAG_PREFIX, BRANCHES, OTHER_BRANCH, PEOPLE_DIR, RESEARCH_DIR, REVISION_PATH, ROOT,
                   SOURCES_DIR, branch_of, is_pending, load_people, load_sources, person_review, source_files,
                   strip_refs_block, sub_links)
from textsearch import norm

SOURCE_ID_RE = re.compile(r"^[Ff]\d+$")
ITEM_RE = re.compile(r"^- (.*)$")
HEADING_RE = re.compile(r"^(#{2,6}) +(.*?)\s*$")
# Without --all, a card for each match up to this many; more than that, the list of candidates
MAX_CARDS = 3
# Text search: matching lines shown per note, and their length
MAX_LINES, LINE_LEN = 5, 200
# A research item in one line (short cards and branches)
ITEM_LEN = 160
# The parts of a card that can be widened (see the usage)
FAMILY, SOURCES, LINKS, ITEMS = "family", "sources", "links", "items"
PARTS = (FAMILY, SOURCES, LINKS, ITEMS)


def short(text, n):
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[:n - 1].rstrip() + "…"


def plain(text):
    """Markdown as plain text: the links become their text, without bold."""
    return sub_links(text, lambda name, label, href: label or name).replace("**", "")


def rel(path):
    return path.relative_to(ROOT).as_posix()


class Tree:
    def __init__(self, show=frozenset()):
        self.show = show
        self.people, errors = load_people()
        for path, msg in errors:
            print(f"warning: {rel(path)}: {msg}", file=sys.stderr)
        self.sources = load_sources()
        # Bodies without the generated «Referencias» / «Personas mencionadas» sections: what someone wrote
        self.notes = {}
        for p in self.people.values():
            self.notes[p.path] = strip_refs_block(p.body)
        for sid in self.sources:
            path = SOURCES_DIR / f"{sid}.md"
            self.notes[path] = strip_refs_block(self.sources[sid]["body"])
        self.links = {path: self.links_in(text) for path, text in self.notes.items()}
        self.normed = {path: norm(text) for path, text in self.notes.items()}
        self.items = self.research_items()
        # The reverse of `siblings`
        self.sibling_of = {}
        for p in self.people.values():
            for s in p.siblings:
                self.sibling_of.setdefault(s, set()).add(p.slug)

    @staticmethod
    def links_in(text):
        found = set()
        sub_links(text, lambda name, label, href: found.add(name) or "")
        return found

    def research_items(self):
        """The top-level bullets of the research documents (but the generated revision.md), with their indented
        lines, the heading path above them and their line number."""
        items = []
        for path in sorted(RESEARCH_DIR.glob("*.md")):
            if path == REVISION_PATH:
                continue
            headings, cur = [], None
            for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if h := HEADING_RE.match(line):
                    level = len(h.group(1))
                    headings = [x for x in headings if x[0] < level] + [(level, h.group(2))]
                    cur = None
                elif m := ITEM_RE.match(line):
                    cur = {"path": path, "line": n, "headings": [t for _, t in headings], "lines": [m.group(1)]}
                    items.append(cur)
                elif cur and line.startswith(("  ", "\t")) and line.strip():
                    cur["lines"].append(line.strip())
                else:
                    cur = None
        for item in items:
            item["text"] = " ".join(item["lines"])
            item["links"] = self.links_in(item["text"])
            item["norm"] = norm(item["text"])
        return items

    # --- Helpers -----------------------------------------------------------

    def label(self, slug):
        p = self.people.get(slug)
        if not p:
            return f"{slug} (missing note)"
        life = p.lifespan()
        return f"{p.name} [{slug}]" + (f" ({life})" if life else "")

    def ref(self, slug):
        """A relative: their slug in the short cards, their label in the full ones."""
        return self.label(slug) if FAMILY in self.show else slug

    def names_of(self, p):
        """The forms of a person's name that identify them in a text: full name and aliases, two words or more."""
        forms = [p.name, *[str(a) for a in (p.meta.get("aliases") or [])]]
        return [n for n in {norm(f) for f in forms} if len(n.split()) >= 2]

    def print_items(self, items, full):
        for item in items:
            where = f"{rel(item['path'])}:{item['line']}"
            path = " › ".join(item["headings"])
            if full:
                print(f"- {where} · {path}\n  {item['text']}")
            else:
                print(f"- {where} · {short(plain(item['text']), ITEM_LEN)}")

    def print_backlinks(self, key, names, skip):
        linked, named = [], []
        for path in self.notes:
            if path in skip:
                continue
            if key in self.links[path]:
                linked.append(path)
            elif names and any(n in self.normed[path] for n in names):
                named.append(path)
        for title, paths in (("linked from", linked), ("named (no link) in", named)):
            if paths:
                print(f"{title}: " + ", ".join(p.stem for p in paths))

    def birth_key(self, slug):
        p = self.people[slug]
        d = p.date("born") or p.date("died")
        return (d.sort_key() if d else (9999,), slug)

    def print_body(self, path):
        print(f"\n{self.notes[path].strip()}")

    # --- Cards -------------------------------------------------------------

    def person_card(self, slug, body=False):
        p, m = self.people[slug], self.people[slug].meta
        print(f"## {p.name} [{slug}] — {rel(p.path)}")
        facts = [f"sex {p.sex}"]
        for key, place in (("born", "birth_place"), ("died", "death_place")):
            if m.get(key) or m.get(place):
                facts.append(f"{key} {m.get(key) or '?'}" + (f", {m[place]}" if m.get(place) else ""))
        for key in ("occupation", "birth_order", "living"):
            if key in m:
                facts.append(f"{key} {m[key]}")
        print(" · ".join(facts))
        if m.get("aliases"):
            print("aliases: " + "; ".join(str(a) for a in m["aliases"]))
        tags = [str(t).removeprefix(BRANCH_TAG_PREFIX) for t in (m.get("tags") or [])]
        branch = branch_of(self.people, slug)
        review = person_review(p, self.sources)
        print(f"branch: {branch or OTHER_BRANCH.key} · tags: {', '.join(tags) or '-'}"
              + (f" · review: {review}" if review else "") + (f" · photo: {m['photo']}" if m.get("photo") else ""))
        if p.father or p.mother:
            print(" · ".join(f"{role}: {self.ref(s)}" for role, s in (("father", p.father), ("mother", p.mother)) if s)
                  + f" · {m.get('parents_confidence', '-')}")
        for s in p.spouses:
            mar = p.marriage(s)
            when = ", ".join(str(mar[k]) for k in ("date", "place") if mar and mar.get(k))
            print(f"spouse: {self.ref(s)}" + (f" — married {when}" if when else ""))
        if p.children:
            print("children: " + "; ".join(self.ref(c) for c in p.children))
        sibs = []
        for o in self.people.values():
            if o.slug == slug:
                continue
            shared = [x for x in (p.father, p.mother) if x and x in (o.father, o.mother)]
            if shared:
                sibs.append(self.ref(o.slug) + ("" if len(shared) == 2 or not (p.father and p.mother) else " (half)"))
            elif o.slug in p.siblings or o.slug in self.sibling_of.get(slug, ()):
                sibs.append(self.ref(o.slug))
        if sibs:
            print("siblings: " + "; ".join(sibs))
        if FAMILY in self.show:
            grand = []
            for side, parent in (("paternal", p.father), ("maternal", p.mother)):
                q = self.people.get(parent)
                if q:
                    found = [self.label(g) for g in (q.father, q.mother) if g]
                    if found:
                        grand.append(f"{side} " + " & ".join(found))
            if grand:
                print("grandparents: " + "; ".join(grand))
        if p.sources and SOURCES in self.show:
            print("sources:")
            for sid in p.sources:
                print("  " + self.source_line(sid))
        elif p.sources:
            print(f"sources ({len(p.sources)}; * pending review): "
                  + " ".join(sid + ("*" if is_pending(sid, self.sources) else "") for sid in p.sources))
        names = self.names_of(p)
        if LINKS in self.show:
            self.print_backlinks(slug, names, {p.path})
        items = [i for i in self.items if slug in i["links"] or any(n in i["norm"] for n in names)]
        if items:
            print(f"research items ({len(items)}):")
            self.print_items(items, ITEMS in self.show)
        if body:
            self.print_body(p.path)

    def source_line(self, sid):
        src = self.sources.get(sid)
        if not src:
            return f"{sid} (missing note)"
        m = src["meta"]
        extra = [str(m[k]) for k in ("date", "status") if m.get(k)]
        if is_pending(sid, self.sources):
            extra.append("review pendiente")
        return f"{sid} — {m.get('title', '')}" + (f" ({', '.join(extra)})" if extra else "")

    def source_card(self, sid, body=False):
        src = self.sources[sid]
        m, path = src["meta"], SOURCES_DIR / f"{sid}.md"
        print(f"## {sid} — {m.get('title', '')} — {rel(path)}")
        if SOURCES in self.show:
            for key in ("type", "category", "date", "place", "issuer", "subject", "pages", "status", "review",
                        "reviewed_by", "origin", "priority", "drive_path", "compilation"):
                if m.get(key) not in (None, ""):
                    print(f"{key}: {m[key]}")
        else:
            print(" · ".join(f"{key} {m[key]}" for key in ("type", "date", "place", "status", "review")
                             if m.get(key) not in (None, "")))
        files = source_files(m)
        if files and SOURCES in self.show:
            print(f"files ({len(files)}): " + ", ".join(rel(f) + ("" if f.exists() else " (missing)") for f in files))
        elif files:
            print(f"files: {len(files)}" + (" (some missing)" if not all(f.exists() for f in files) else ""))
        cited = [s for s, p in self.people.items() if sid in p.sources]
        if cited:
            print("cited by: " + "; ".join(self.ref(s) for s in cited))
        if LINKS in self.show:
            self.print_backlinks(sid, [], {path} | {self.people[s].path for s in cited})
        items = [i for i in self.items if sid in i["links"] or f" {sid.lower()} " in i["norm"]]
        if items:
            print(f"research items ({len(items)}):")
            self.print_items(items, ITEMS in self.show)
        if body:
            self.print_body(path)

    def branch_card(self, key):
        branch = next((b for b in BRANCHES if b.key == key), None)
        if not branch:
            print(f"## rama/{key}: no such branch (known: {', '.join(b.key for b in BRANCHES)})")
            return
        tag = BRANCH_TAG_PREFIX + key
        slugs = [s for s, p in self.people.items() if tag in (p.meta.get("tags") or []) or branch_of(self.people, s) == key]
        slugs.sort(key=self.birth_key)
        print(f"## Branch {branch.label} [{key}] — family {branch.family}, founder {self.label(branch.founder)}")
        print(f"people ({len(slugs)}):")
        for s in slugs:
            p = self.people[s]
            parents = " & ".join(x for x in (p.father, p.mother) if x)
            print(f"- {self.label(s)}" + (f" · child of {parents}" if parents and FAMILY in self.show else "")
                  + (f" · {len(p.sources)} sources" if p.sources else " · no sources"))
        label = norm(branch.label)
        items = [i for i in self.items if any(label in norm(h) for h in i["headings"][1:])]
        if items:
            print(f"research items in its sections ({len(items)}):")
            self.print_items(items, ITEMS in self.show)

    # --- Searches ----------------------------------------------------------

    def find_people(self, query):
        """Slugs matching a query: the exact slug, or every word of it at the start of a word of the name, the
        aliases or the slug. Exact names first."""
        if query in self.people:
            return [query]
        words = norm(query).split()
        if not words:
            return []
        exact, partial = [], []
        for slug, p in self.people.items():
            hay = norm(" ".join([p.name, slug.replace("-", " "), *[str(a) for a in (p.meta.get("aliases") or [])]]))
            tokens = hay.split()
            if all(any(t.startswith(w) for t in tokens) for w in words):
                (exact if norm(query) in self.names_of(p) or norm(query) == norm(p.name) else partial).append(slug)
        return exact or partial

    def text_search(self, query):
        q = norm(query).strip()
        print(f"## Text «{query}»")
        if not q:
            return
        paths = [*self.notes, *[p for p in sorted(RESEARCH_DIR.glob("*.md")) if p != REVISION_PATH]]
        hits = 0
        for path in paths:
            lines = path.read_text(encoding="utf-8").splitlines() if path.parent == RESEARCH_DIR \
                else self.notes[path].splitlines()
            found = [(n, line) for n, line in enumerate(lines, 1) if q in norm(line)]
            if not found:
                continue
            hits += 1
            title = {PEOPLE_DIR: lambda: " — " + self.label(path.stem),
                     SOURCES_DIR: lambda: " — " + self.source_line(path.stem)}.get(path.parent, lambda: "")()
            print(f"{rel(path)}{title}" + (f" ({len(found)} lines)" if len(found) > MAX_LINES else ""))
            for n, line in found[:MAX_LINES]:
                print(f"  {n}: {short(line, LINE_LEN)}")
        if not hits:
            print("no matches")

    def query(self, q, body=False, text=False, all_cards=False):
        q = q.strip()
        if text:
            return self.text_search(q)
        if SOURCE_ID_RE.match(q):
            sid = "F" + q[1:]
            if sid in self.sources:
                return self.source_card(sid, body)
        if q.startswith(BRANCH_TAG_PREFIX):
            return self.branch_card(q.removeprefix(BRANCH_TAG_PREFIX))
        slugs = self.find_people(q)
        if not slugs:
            return self.text_search(q)
        if len(slugs) <= MAX_CARDS or all_cards:
            for i, s in enumerate(slugs):
                if i:
                    print()
                self.person_card(s, body)
            return
        print(f"## {len(slugs)} people match «{q}»; ask for one by slug")
        for s in slugs:
            print(f"- {self.label(s)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("queries", nargs="+", metavar="QUERY")
    for part, text in ((FAMILY, "relatives with their names and dates, and the grandparents"),
                       (SOURCES, "the title, date and state of each source; all the fields and files of a source"),
                       (LINKS, "the notes that link or name the person or source"),
                       (ITEMS, "the research items in full")):
        parser.add_argument(f"--{part}", action="store_true", help=text)
    parser.add_argument("--full", action="store_true", help="all of the above")
    parser.add_argument("--body", action="store_true", help="also print the note's body")
    parser.add_argument("--text", action="store_true", help="search the text of the notes, not people")
    parser.add_argument("--all", action="store_true", help="a card for every matching person")
    args = parser.parse_args()
    tree = Tree(frozenset(p for p in PARTS if args.full or getattr(args, p)))
    for i, q in enumerate(args.queries):
        if i:
            print()
        tree.query(q, body=args.body, text=args.text, all_cards=args.all)


if __name__ == "__main__":
    main()
