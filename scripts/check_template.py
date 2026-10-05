#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Check of the engine against the family: no name of the family's people in the files of the engine (the list is
scripts/template_paths.txt), which are shared with the public template. Everything else in the repository must be the
family's (families.yml, places.yml, TREE.md, .obsidian/graph.json and the data folders): a file that is neither is an
error, so that every new file is classified.

What it looks for, with the normalization of the leak check (without accents, capitals or punctuation, whole words):
the slug of each person, their given name with their first surname and with all their surnames, their aliases of more
than one word, each surname that is not a common word (see COMMON) and the labels and titles of the families. Any match
is an error.

With --rev it checks a commit instead of the working tree: its engine files and the messages (subject and body) of
the commits it brings, which are published with it. A message must not name the family either, nor carry the line
«(cherry picked from commit …)» of `git cherry-pick -x`, whose hash is that of a private commit.

It also warns if README.md and README.es.md do not have the same sections, or if one changed after the other.

Usage:
  uv run scripts/check_template.py                  # the engine's files in the working tree
  uv run scripts/check_template.py --rev <commit> [--remote <name>]
      # the engine's files in a commit and the messages of the commits it brings: all of its history or, with
      # --remote, only what that remote does not have yet (the pre-push hook)
  uv run scripts/check_template.py --family-paths   # the family's files and folders, one per line

The names are those of the tree in ARBRE_ROOT (by default, this repository); without families.yml there is nothing
to look for.
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

import yaml

from textsearch import norm, readable

CODE_ROOT = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ["ARBRE_ROOT"]).resolve() if os.environ.get("ARBRE_ROOT") else CODE_ROOT
ENGINE_LIST = CODE_ROOT / "scripts" / "template_paths.txt"
# The family's files besides the data folders
FAMILY_FILES = ("families.yml", "places.yml", "TREE.md", ".obsidian/graph.json")
# Default data folders, as in scripts/arbre.py (which cannot be imported without families.yml)
DEFAULT_PATHS = {"people": "people", "sources": "sources", "research": "research", "portraits": "portraits"}
# Surnames shorter than this are not searched alone (they are part of too many words)
MIN_SURNAME = 4
# Surnames that are also common words or appear in the engine for their own sake; they are still searched as part of
# full names and slugs. Each one says why.
COMMON = {
    "cartagena": "Spanish city (naval archives are there)",
    "costa": "Spanish and Catalan word: coast",
    "diez": "Spanish word: ten (court edicts: «cita por diez días»)",
    "fuentes": "Spanish word: sources (the data values and texts use it)",
    "font": "CSS and typography word (font-family) and a common Catalan surname",
    "garcia": "one of the commonest Spanish surnames (fictional people of the tests)",
    "guerra": "Spanish word: war",
    "iglesias": "Spanish word: churches, and the name of institutions (Fundación Pablo Iglesias)",
    "nieto": "Spanish word: grandson",
    "perez": "one of the commonest Spanish surnames (fictional people of the tests)",
    "sans": "CSS and typography word (sans-serif) and a common Catalan surname",
    "soler": "one of the commonest Catalan surnames (fictional people of the tests and the example)",
    "villa": "Spanish word: town (and part of many place names)",
    "vivas": "Spanish word: living (women)",
}
# Engine files not searched, and why
SKIPPED = {"LICENSE": "its copyright notice names the author on purpose"}
READMES = ("README.md", "README.es.md")
MAX_BYTES = 5_000_000
# Line that `git cherry-pick -x` adds to the message: it would publish the hash of a private commit
CHERRY_PICK_MARK = "(cherry picked from commit"


def git(*args, cwd=CODE_ROOT):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True).stdout


def data_paths():
    """The family's files and data folders (from `paths` of families.yml, with its defaults)."""
    config = ROOT / "families.yml"
    try:
        raw = yaml.safe_load(config.read_text(encoding="utf-8")) if config.is_file() else {}
    except yaml.YAMLError:
        raw = {}
    # A families.yml that is not a mapping (validate.py says why) still leaves the default folders to protect
    given = raw.get("paths") if isinstance(raw, dict) else None
    paths = {**DEFAULT_PATHS, **(given if isinstance(given, dict) else {})}
    return list(FAMILY_FILES) + [folder + "/" for folder in paths.values()]


def engine_paths():
    lines = ENGINE_LIST.read_text(encoding="utf-8").splitlines()
    return [x.strip() for x in lines if x.strip() and not x.startswith("#")]


def under(path, entries):
    return any(path == e.rstrip("/") or path.startswith(e.rstrip("/") + "/") for e in entries)


def needles():
    """{normalized needle: what it is} of the family in ROOT."""
    from arbre import CONFIG, load_people
    found = {}

    def add(value, what, min_words=1):
        n = norm(value).strip()
        if n and len(n.split()) >= min_words:
            found.setdefault(n, what)

    people, errors = load_people()
    if errors:
        sys.exit("Some files have errors; run scripts/validate.py")
    for slug, p in people.items():
        given = str(p.meta.get("given_name") or "")
        surnames = str(p.meta.get("surnames") or "").split()
        add(slug.replace("-", " "), f"slug of {slug}", min_words=2)
        if given and surnames:
            add(f"{given} {surnames[0]}", f"name of {slug}")
            add(f"{given} {' '.join(surnames)}", f"name of {slug}")
        for alias in p.meta.get("aliases") or []:
            add(alias, f"alias of {slug}", min_words=2)
        for s in surnames:
            n = norm(s).strip()
            if len(n) >= MIN_SURNAME and n not in COMMON:
                add(s, f"surname of {slug}")
    for f in CONFIG.families:
        for v in (f.label, f.title):
            add(v, f"family {f.key}", min_words=2)
    return found


def files(rev):
    """(path, bytes) of every file of the repository, in the working tree or in `rev`."""
    if rev:
        listing = git("ls-tree", "-r", "-z", "--full-tree", rev).split(b"\0")
        entries = [(line.split(b"\t", 1)[1].decode(), line.split()[2].decode()) for line in listing if line]
        for path, sha in entries:
            size = int(git("cat-file", "-s", sha))
            yield path, git("cat-file", "blob", sha) if size <= MAX_BYTES else b""
        return
    listing = git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split(b"\0")
    for path in dict.fromkeys(x.decode() for x in listing if x):
        f = CODE_ROOT / path
        if f.is_symlink():
            yield path, os.readlink(f).encode()
        elif f.is_file():
            yield path, f.read_bytes() if f.stat().st_size <= MAX_BYTES else b""


def check(rev, wanted):
    """([(path, line, needle, what)], [unclassified paths])."""
    engine, family = engine_paths(), data_paths()
    found, unclassified = [], []
    for path, content in files(rev):
        if not under(path, engine):
            # .gitkeep: the empty data folders the template used to carry, and that a tree may still have
            if not under(path, family) and not path.endswith("/.gitkeep"):
                unclassified.append(path)
            continue
        if path in SKIPPED:
            continue
        text = "" if b"\0" in content else readable(content.decode("utf-8", errors="replace"))
        whole = norm(path) + norm(text)
        for n, what in wanted.items():
            if f" {n} " not in whole:
                continue
            lines = [i for i, line in enumerate(text.splitlines(), 1) if f" {n} " in norm(line)]
            found += [(path, i, n, what) for i in lines or [0]]
    return found, unclassified


def messages(rev, remote, wanted):
    """[(commit, needle, what)] of the messages of the commits `rev` brings: all of its history, or with `remote`,
    the commits that remote does not have yet (as its remote-tracking branches know it)."""
    exclude = [f"--remotes={remote}"] if remote else []
    log = git("log", "-z", "--format=%H%n%B", rev, "--not", *exclude, "--").decode("utf-8", errors="replace")
    found = []
    for entry in filter(None, log.split("\0")):
        sha, _, body = entry.partition("\n")
        if CHERRY_PICK_MARK in body:
            found.append((sha, CHERRY_PICK_MARK, "hash of a private commit (git cherry-pick -x)"))
        text = norm(body)
        found += [(sha, n, what) for n, what in wanted.items() if f" {n} " in text]
    return found


def readme_warnings():
    """README.md and README.es.md are the same text in two languages: the same sections, changed together."""
    out = []
    heads = []
    for name in READMES:
        f = CODE_ROOT / name
        text = f.read_text(encoding="utf-8") if f.is_file() else ""
        heads.append([len(m) for m in re.findall(r"^(#+) ", re.sub(r"```.*?```", "", text, flags=re.S), re.M)])
    if heads[0] != heads[1]:
        out.append(f"{READMES[0]} and {READMES[1]} do not have the same sections")
    changed = git("status", "--porcelain", "--", *READMES).decode().splitlines()
    last = [git("log", "-1", "--format=%H", "--", name).decode().strip() for name in READMES]
    if len(changed) == 1 or (not changed and last[0] != last[1]):
        out.append(f"{READMES[0]} and {READMES[1]} have not been changed together")
    return out


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--rev", help="check the files of this commit and the messages of its history instead of the "
                    "working tree")
    ap.add_argument("--remote", help="with --rev, only the messages of the commits this remote does not have")
    ap.add_argument("--family-paths", action="store_true", help="print the family's files and folders")
    args = ap.parse_args(argv)
    # The hook reads this output in a shell: no «\r» at the end of the lines, also on Windows
    sys.stdout.reconfigure(newline="\n")
    if args.family_paths:
        print("\n".join(data_paths()))
        return
    if not (ROOT / "families.yml").is_file():
        print(f"check-template: no families.yml in {ROOT}: no names to look for")
    if args.remote and not args.rev:
        ap.error("--remote needs --rev")
    wanted = needles() if (ROOT / "families.yml").is_file() else {}
    found, unclassified = check(args.rev, wanted)
    in_messages = messages(args.rev, args.remote, wanted) if args.rev else []
    for path in unclassified:
        print(f"UNCLASSIFIED: {path} (add it to {ENGINE_LIST.relative_to(CODE_ROOT)} if it is the engine's)",
              file=sys.stderr)
    for path, line, n, what in found:
        print(f"NAME: {path}:{line}: «{n}» — {what}", file=sys.stderr)
    for sha, n, what in in_messages:
        print(f"MESSAGE: {sha[:12]}: «{n}» — {what}", file=sys.stderr)
    if not args.rev:
        for w in readme_warnings():
            print(f"check-template: warning: {w}")
    summary = f"{len(found)} names, {len(unclassified)} unclassified files"
    if args.rev:
        summary += f", {len(in_messages)} in commit messages"
    print(f"check-template: {summary}")
    if found or unclassified or in_messages:
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
