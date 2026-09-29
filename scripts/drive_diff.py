#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Compares the family's Drive folder with drive-manifest.tsv, in the research folder
(`paths.research` in families.yml).

Lists the new, modified, removed and moved or renamed files (same content at another path). For speed it
compares path and size, and only computes the md5 of what is new or has changed size; with --full it computes the
md5 of everything (slow: the Drive downloads each file).

Usage:
  uv run scripts/drive_diff.py DRIVE_DIR [--full]
  uv run scripts/drive_diff.py DRIVE_DIR --record PATH_IN_DRIVE DEST   # after importing a file

DEST is the path inside the sources folder (e.g. F100/acta.png) or «descartado: reason».
"""

import argparse
import hashlib
import sys
from pathlib import Path

from arbre import CONFIG, RESEARCH_DIR

MANIFEST = RESEARCH_DIR / "drive-manifest.tsv"
SOURCES = CONFIG.paths.sources
IGNORE = {"Thumbs.db", "desktop.ini", ".DS_Store"}
# Destination of the files that were not imported («descartado: reason»), as written in the manifest
DISCARDED = "descartado"


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load():
    header, rows = [], {}
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or line.startswith("drive_path\t"):
            header.append(line)
            continue
        path, size, digest, dest = line.split("\t", 3)
        rows[path] = {"size": int(size), "md5": digest, "dest": dest}
    return header, rows


def save(header, rows):
    lines = header + [f"{p}\t{r['size']}\t{r['md5']}\t{r['dest']}" for p, r in sorted(rows.items())]
    MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("drive_dir", type=Path)
    ap.add_argument("--full", action="store_true", help="compute the md5 of every file")
    ap.add_argument("--record", nargs=2, metavar=("PATH", "DEST"),
                    help="record in the manifest a file already imported (or discarded)")
    args = ap.parse_args(argv)
    if not args.drive_dir.is_dir():
        sys.exit(f"{args.drive_dir} does not exist (is the Drive mounted?)")
    header, rows = load()

    if args.record:
        rel, dest = args.record
        f = args.drive_dir / rel
        rows[rel] = {"size": f.stat().st_size, "md5": md5(f), "dest": dest}
        save(header, rows)
        print(f"recorded: {rel} -> {dest}")
        return 0

    current = {str(p.relative_to(args.drive_dir)): p for p in sorted(args.drive_dir.rglob("*"))
               if p.is_file() and p.name not in IGNORE}
    by_md5 = {}
    for path, r in rows.items():
        by_md5.setdefault(r["md5"], []).append(path)

    new, changed, moved = [], [], []
    for rel, p in current.items():
        size = p.stat().st_size
        known = rows.get(rel)
        if known and known["size"] == size and not args.full:
            continue
        digest = md5(p)
        if known:
            if digest != known["md5"]:
                changed.append((rel, known["dest"]))
        elif digest in by_md5:
            moved.append((rel, by_md5[digest]))
        else:
            new.append((rel, size))
    moved_from = {old for _, olds in moved for old in olds}
    removed = [p for p in rows if p not in current and p not in moved_from and Path(p).name not in IGNORE]

    def section(title, items, fmt):
        print(f"\n## {title} ({len(items)})")
        for it in items:
            print("- " + fmt(it))

    section("New", new, lambda x: f"{x[0]}  ({x[1] / 1e6:.1f} MB)")
    section("Modified", changed, lambda x: f"{x[0]}  (imported in {SOURCES}/{x[1]})")
    section("Moved or renamed", moved, lambda x: f"{x[0]}  (before: {', '.join(x[1])})")
    def where(dest):
        return dest if dest.startswith(DISCARDED) else f"still in {SOURCES}/{dest}"

    section("Removed from the Drive", removed, lambda x: f"{x}  ({where(rows[x]['dest'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
