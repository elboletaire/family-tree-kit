#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Regenerates the «Referencias» (people) and «Personas mencionadas» (sources) sections from each person's
`sources` field, and revision.md in the research folder.

Usage: uv run scripts/references.py
"""

import sys

from arbre import ROOT, generated_files, load_people, load_sources


def main():
    people, errors = load_people()
    if errors:
        sys.exit("Some files have errors; run scripts/validate.py")
    changed = 0
    for path, expected in generated_files(people, load_sources()).items():
        if not path.exists() or path.read_text(encoding="utf-8") != expected:
            path.write_text(expected, encoding="utf-8")
            changed += 1
            print(f"updated: {path.relative_to(ROOT)}")
    print(f"{changed} files updated")


if __name__ == "__main__":
    main()
