"""What's new in the tree: the changes of its data, day by day, read from the Git history.

Not from the commit messages: for each day with commits, the notes as they were at the end of the previous day are
compared with the notes as they were at the end of that day (the net change of the day, so that a fact added and
corrected the same day is one change). Only the data folders count (`paths` of families.yml): people, sources and the
two research documents with open items.

- Sources: added, approved (`review` from `pendiente` to `revisada`), updated (their title, date, place, files or
  transcription) and removed.
- People: added, removed, renamed (Git's rename detection, `old-slug.md` → `new-slug.md`, or a note removed and another
  added the same day with the same given name and surnames that extend each other) and, for the others, which
  facts changed (FIELDS: name, dates, places, parents, spouses, photo…; the biography and the research notes, without
  the generated «Referencias») and which sources they cite now that they did not.
- Research: the open items (`- [ ]`) of incoherencias.md and pendientes.md that appeared or were closed, each with
  the family of the `## ` section it is in (arbre.family_sections: a family key, `several` or `general`).

The days are grouped along the first-parent line of the branch (the merges of the kit bring no data), bounded by
`history_months` of families.yml (by default 6; 0 turns it off) and by MAX_DAYS. Each day's changes only
depend on its two commits, so they are cached in build/history-cache.json by their hashes.

Without Git, outside a repository or with a shallow clone (the oldest day would look like the whole tree being
added) there is simply less or no history: never an error. The deploy builds from a checkout without .git: its hook
passes the bare repository in ARBRE_GIT_DIR (and the branch in ARBRE_GIT_REF).

The changes are first computed raw (slugs, ids, texts of the notes) and `entries` turns them into the web's
`DATA.history`: the ids that still exist, followed through later renames; with `view` (the public version), only
deceased people and public documents, and nothing of the removed, the renamed nor the research documents.
"""

import datetime as dt
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import yaml

from arbre import (CONFIG, GENERAL, REVIEW_DONE, REVIEW_PENDING, ROOT, FrontmatterError, MD_LINK_RE, WIKI_LINK_RE,
                   family_sections, split_frontmatter, strip_refs_block)
from privacy import RESEARCH_HEADING_RE
from textsearch import norm

MAX_DAYS = 400
# 3: the research items carry the family of their section
CACHE_VERSION = 3
# Research documents whose open items are followed (their names are also the `r:` panels of the web)
RESEARCH_NOTES = ("incoherencias", "pendientes")
# Facts of a person, by the key the web translates: the frontmatter keys each one is made of
FIELDS = {
    "name": ("given_name", "surnames"),
    "aliases": ("aliases",),
    "sex": ("sex",),
    "born": ("born",),
    "birthPlace": ("birth_place",),
    "died": ("died",),
    "deathPlace": ("death_place",),
    "occupation": ("occupation",),
    "parents": ("father", "mother", "parents_confidence"),
    "siblings": ("siblings",),
    "spouses": ("spouses", "marriages"),
    "photo": ("photo",),
}
BIOGRAPHY, NOTES = "biography", "notes"
# What of a source counts as updating it
SOURCE_FIELDS = ("title", "type", "category", "date", "place", "issuer", "pages", "files")
ITEM_RE = re.compile(r"^- \[([ xX])\] (.*)$")
BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
ITEM_LEN = 160


# --- Git ----------------------------------------------------------------------

class Git:
    """The repository of the tree: ARBRE_GIT_DIR (a bare repository, in the deploy) or the one ROOT is in."""

    def __init__(self):
        self.ref = os.environ.get("ARBRE_GIT_REF") or "HEAD"
        git_dir = os.environ.get("ARBRE_GIT_DIR")
        self.base = ["git", f"--git-dir={git_dir}"] if git_dir else ["git", "-C", str(ROOT)]
        self.prefix = ""
        if not git_dir:
            self.prefix = (self.run("rev-parse", "--show-prefix") or "").strip()

    def run(self, *args, data=None):
        """Output of a git command (bytes if `data`, the input, is bytes), or None if it fails."""
        try:
            out = subprocess.run([*self.base, *args], input=data, capture_output=True, check=True,
                                 text=not isinstance(data, bytes),
                                 env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "LC_ALL": "C"})
        except (OSError, subprocess.CalledProcessError):
            return None
        return out.stdout

    def blobs(self, shas):
        """{sha: text} of the blobs, read in one go."""
        shas = sorted(set(shas))
        if not shas:
            return {}
        out = self.run("cat-file", "--batch", data=("\n".join(shas) + "\n").encode())
        texts, pos = {}, 0
        while out and pos < len(out):
            end = out.index(b"\n", pos)
            head = out[pos:end].decode().split()
            pos = end + 1
            if len(head) < 3 or head[1] != "blob":  # «<sha> missing»
                continue
            size = int(head[2])
            texts[head[0]] = out[pos:pos + size].decode("utf-8", errors="replace")
            pos += size + 1
        return texts


def days(git, months, today):
    """[(date, base commit or None for the first one, last commit of the day)] along the first-parent line, oldest
    first, of the last `months`. None if there is no history to read."""
    if not shutil.which("git") or git.run("rev-parse", "--verify", "--quiet", f"{git.ref}^{{commit}}") is None:
        return None
    since = today - dt.timedelta(days=round(months * 30.44))
    log = git.run("log", "--first-parent", "--reverse", "--format=%H %cs %P", f"--since={since.isoformat()}",
                  git.ref)
    if log is None:
        return None
    shallow = (git.run("rev-parse", "--is-shallow-repository") or "").strip() == "true"
    runs = []
    for line in log.splitlines():
        sha, date, *parents = line.split()
        if runs and runs[-1][0] == date:
            runs[-1][2] = sha
        else:
            # A commit without parents in a shallow clone is only where the clone stops: not the start of the tree
            if not parents and shallow:
                runs.append([date, "", sha])  # marked to skip
                continue
            runs.append([date, parents[0] if parents else None, sha])
    return [(d, base, head) for d, base, head in runs if base != ""][-MAX_DAYS:]


# --- Notes -------------------------------------------------------------------

def parse(text):
    try:
        return split_frontmatter(text)
    except (FrontmatterError, yaml.YAMLError):
        return {}, text


def plain(text):
    """Markdown of an item, as plain text: the links become their text, no bold, one line."""
    text = WIKI_LINK_RE.sub(lambda m: m.group(2) or m.group(1), text)
    text = MD_LINK_RE.sub(lambda m: m.group(1), text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\s+", " ", text.replace("**", "").replace("`", "")).strip()
    return text if len(text) <= ITEM_LEN else text[:ITEM_LEN - 1].rstrip() + "…"


def open_items(text):
    """{text: family} of the open items (`- [ ] …`, with their indented lines) of a research document: each one by its
    bold title, or its whole text, as plain text; and the family of the section it is in (before any, `general`)."""
    out = {}
    for family, chunk in family_sections(text or ""):
        items, cur = [], None
        for line in chunk.splitlines():
            if m := ITEM_RE.match(line):
                cur = {"open": m.group(1) == " ", "lines": [m.group(2)]}
                items.append(cur)
            elif cur and line.startswith("  ") and line.strip():
                cur["lines"].append(line.strip())
            else:
                cur = None
        for item in items:
            if item["open"]:
                title = BOLD_RE.match(item["lines"][0])
                out.setdefault(plain(title.group(1) if title else " ".join(item["lines"])), family or GENERAL)
    return out


def person_name(meta):
    given = meta.get("given_name") or "N. N."
    return " ".join(str(x) for x in (given, meta.get("surnames") or "") if x)


def links(value):
    if not isinstance(value, list):
        return []
    return [m.group(1).strip() for v in value if isinstance(v, str) and (m := WIKI_LINK_RE.search(v))]


def body_parts(body):
    """(biography, research notes) of a person's body, without the generated references."""
    body = strip_refs_block(body)
    notes = "".join(m.group(0) for m in RESEARCH_HEADING_RE.finditer(body))
    return RESEARCH_HEADING_RE.sub("", body).strip(), notes.strip()


def person_changes(old, new):
    """(changed fields, sources cited now and not before) between two versions of a person's note."""
    (om, ob), (nm, nb) = parse(old), parse(new)
    fields = [k for k, keys in FIELDS.items() if any(om.get(x) != nm.get(x) for x in keys)]
    (obio, onotes), (nbio, nnotes) = body_parts(ob), body_parts(nb)
    if obio != nbio:
        fields.append(BIOGRAPHY)
    if onotes != nnotes:
        fields.append(NOTES)
    before = set(links(om.get("sources")))
    return fields, [s for s in links(nm.get("sources")) if s not in before]


def source_changes(old, new):
    """(approved, updated) between two versions of a source's note."""
    (om, ob), (nm, nb) = parse(old), parse(new)
    approved = om.get("review") == REVIEW_PENDING and nm.get("review") == REVIEW_DONE
    updated = any(om.get(k) != nm.get(k) for k in SOURCE_FIELDS) or strip_refs_block(ob) != strip_refs_block(nb)
    return approved, updated


# --- One day -------------------------------------------------------------------

def folders():
    return {"people": CONFIG.paths.people, "sources": CONFIG.paths.sources, "research": CONFIG.paths.research}


def classify(path, prefix):
    """(role, name) of a note of the data folders, or None: `people/<slug>.md`, `sources/<id>.md` (not the originals
    in their folders) and the followed research documents."""
    if not path.startswith(prefix):
        return None
    parts = path[len(prefix):].split("/")
    if len(parts) != 2 or not parts[1].endswith(".md"):
        return None
    name = parts[1][:-3]
    for role, folder in folders().items():
        if parts[0] == folder and (role != "research" or name in RESEARCH_NOTES):
            return role, name
    return None


def day_changes(git, base, head):
    """Raw changes between two commits (base None: from nothing, the start of the tree)."""
    empty = (git.run("hash-object", "-t", "tree", "--stdin", data=b"") or b"").decode().strip()
    old = base or empty
    paths = [git.prefix + f for f in folders().values()]
    out = git.run("diff-tree", "-r", "-z", "-M", "--no-abbrev", "--raw", old, head, "--", *paths, data=b"")
    if out is None:
        return None
    fields = out.decode("utf-8", errors="replace").split("\0")
    changes, i = [], 0
    while i < len(fields) - 1:
        meta = fields[i].lstrip(":").split()
        if len(meta) < 5:
            i += 1
            continue
        status = meta[4][0]
        if status in "RC":
            changes.append((status, meta[2], meta[3], fields[i + 1], fields[i + 2]))
            i += 3
        else:
            changes.append((status, meta[2], meta[3], fields[i + 1], fields[i + 1]))
            i += 2
    texts = git.blobs([s for c in changes for s in c[1:3] if set(s) != {"0"}])
    text = lambda sha: texts.get(sha, "")  # noqa: E731
    changes = pair_renames(changes, text, git.prefix)

    raw = {"docsAdded": [], "docsReviewed": [], "docsUpdated": [], "docsRemoved": [], "peopleAdded": [],
           "peopleChanged": [], "peopleRemoved": [], "peopleRenamed": [], "researchOpened": [],
           "researchResolved": [], "first": base is None}
    for status, osha, nsha, opath, npath in changes:
        was, now = classify(opath, git.prefix), classify(npath, git.prefix)
        if status == "R" and (not was or not now or was[0] != now[0]):
            # Moved in or out of the data folders: as removed and added
            if was:
                apply(raw, "D", was, None, osha, "", text)
            if now:
                apply(raw, "A", None, now, "", nsha, text)
            continue
        if status == "C":
            status, was = "A", None
        if was or now:
            apply(raw, status, was, now, osha, nsha, text)
    for k, v in raw.items():
        if isinstance(v, list) and v and isinstance(v[0], str):
            raw[k] = sorted(set(v))
    return raw


def same_person(old, new):
    """Do two notes look like the same person renamed? The same given name, and the surnames of one are the first ones
    of the other («Rosa Puig» → «Rosa Puig Vidal»), without accents, capitals nor particles («de», «y»)."""
    (om, _), (nm, _) = parse(old), parse(new)
    given = [norm(m.get("given_name") or "").strip() for m in (om, nm)]
    surnames = [[w for w in norm(m.get("surnames") or "").split() if len(w) > 2] for m in (om, nm)]
    if not given[0] or given[0] != given[1] or not all(surnames):
        return False
    short, long = sorted(surnames, key=len)
    return long[:len(short)] == short


def pair_renames(changes, text, prefix):
    """The people removed and added the same day that are the same person (see same_person), as renames: Git only
    detects a rename when the note kept most of its text, and a rename often comes with a rewritten note."""
    def people(status):
        return [c for c in changes if c[0] == status and (classify(c[3], prefix) or ("",))[0] == "people"]
    added, out, paired = people("A"), [], set()
    for c in changes:
        if c[0] == "D" and c in people("D"):
            match = [a for a in added if id(a) not in paired and same_person(text(c[1]), text(a[2]))]
            if len(match) == 1:
                paired.add(id(match[0]))
                out.append(("R", c[1], match[0][2], c[3], match[0][4]))
                continue
        out.append(c)
    return [c for c in out if id(c) not in paired]


def apply(raw, status, was, now, osha, nsha, text):
    role = (now or was)[0]
    if role == "research":
        name = (now or was)[1]
        before = open_items(text(osha)) if status != "A" else {}
        after = open_items(text(nsha)) if status != "D" else {}
        raw["researchOpened"] += [{"note": name, "text": t, "family": after[t]} for t in sorted(after.keys() - before)]
        raw["researchResolved"] += [{"note": name, "text": t, "family": before[t]}
                                    for t in sorted(before.keys() - after)]
    elif role == "sources":
        if status == "A":
            raw["docsAdded"].append(now[1])
        elif status == "D":
            raw["docsRemoved"].append({"id": was[1], "title": str(parse(text(osha))[0].get("title") or "")})
        else:
            approved, updated = source_changes(text(osha), text(nsha))
            if approved:
                raw["docsReviewed"].append(now[1])
            elif updated:
                raw["docsUpdated"].append(now[1])
    else:
        if status == "A":
            raw["peopleAdded"].append(now[1])
        elif status == "D":
            raw["peopleRemoved"].append({"id": was[1], "name": person_name(parse(text(osha))[0])})
        else:
            if status == "R" and was[1] != now[1]:
                raw["peopleRenamed"].append({"from": was[1], "fromName": person_name(parse(text(osha))[0]),
                                             "to": now[1]})
            fields, sources = person_changes(text(osha), text(nsha))
            if fields or sources:
                raw["peopleChanged"].append({"id": now[1], "fields": fields, "sources": sources})


# --- The whole history ------------------------------------------------------------

def load_cache(path):
    try:
        cache = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if cache.get("version") != CACHE_VERSION or cache.get("prefix") != folders():
        return {}
    return cache.get("days") or {}


def raw_history(months=None, today=None, cache_path=None):
    """[(date, raw changes)] of the days with changes in the data, oldest first; [] without history."""
    months = CONFIG.history_months if months is None else months
    if months <= 0:
        return []
    git = Git()
    found = days(git, months, today or dt.date.today())
    if not found:
        return []
    cache_path = cache_path or ROOT / "build" / "history-cache.json"
    cache, used, out = load_cache(cache_path), {}, []
    for date, base, head in found:
        key = f"{base or 'root'}..{head}"
        raw = cache.get(key)
        if raw is None:
            raw = day_changes(git, base, head)
            if raw is None:
                continue
        used[key] = raw
        if any(v for k, v in raw.items() if k != "first"):
            out.append((date, raw))
    try:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps({"version": CACHE_VERSION, "prefix": folders(), "days": used},
                                         ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return out


def entries(raw_days, people, sources, view=None):
    """DATA.history: the days, newest first, with the ids of what still exists (followed through the renames made
    after each day); with `view` (privacy.PublicView), only what the public version shows."""
    public = view is not None
    living = view.living if public else {}
    docs_ok = view.public_docs if public else set(sources)
    # Dates that are a living person's (a birth): the day would name it in the public version
    hidden_dates = {d for s in living for d in view.dates.get(s, ())} if public else set()

    def name_key(slug):
        return (people[slug].name, slug)

    out, forward = [], {}
    for date, raw in reversed(raw_days):
        now = lambda slug: forward.get(slug, slug)  # noqa: E731
        shown = lambda slug: now(slug) in people and now(slug) not in living  # noqa: E731
        changed = {}
        for c in raw["peopleChanged"]:
            if not shown(c["id"]):
                continue
            fields = [f for f in c["fields"] if not (public and f == NOTES)]
            srcs = [s for s in c["sources"] if s in docs_ok]
            if fields or srcs:
                prev = changed.setdefault(now(c["id"]), {"id": now(c["id"]), "fields": [], "sources": []})
                prev["fields"] += [f for f in fields if f not in prev["fields"]]
                prev["sources"] += [s for s in srcs if s not in prev["sources"]]
        added = sorted({now(s) for s in raw["peopleAdded"] if shown(s)}, key=name_key)
        entry = {
            "date": date,
            "first": raw["first"],
            "docsAdded": [s for s in raw["docsAdded"] if s in docs_ok],
            "docsReviewed": [s for s in raw["docsReviewed"] if s in docs_ok],
            "docsUpdated": [s for s in raw["docsUpdated"] if s in docs_ok],
            "peopleAdded": added,
            "peopleChanged": sorted((c for k, c in changed.items() if k not in added), key=lambda c: name_key(c["id"])),
            "peopleRemoved": [] if public else sorted(x["name"] for x in raw["peopleRemoved"]),
            "peopleRenamed": [] if public else [{"from": r["fromName"], "to": now(r["to"])}
                                                for r in raw["peopleRenamed"] if shown(r["to"])],
            "docsRemoved": [] if public else [f"{x['id']} — {x['title']}" if x["title"] else x["id"]
                                              for x in raw["docsRemoved"]],
            "research": [] if public else (
                [{"note": x["note"], "text": x["text"], "family": x["family"], "resolved": False}
                 for x in raw["researchOpened"]]
                + [{"note": x["note"], "text": x["text"], "family": x["family"], "resolved": True}
                   for x in raw["researchResolved"]]),
        }
        for r in raw["peopleRenamed"]:
            forward[r["from"]] = now(r["to"])
        if public and (date in hidden_dates or date[:7] in hidden_dates):
            continue
        if any(v for k, v in entry.items() if k not in ("date", "first")):
            out.append(entry)
    return out

