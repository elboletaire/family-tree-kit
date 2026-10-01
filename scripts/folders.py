#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Creates the data folders named in `paths` of families.yml (people, sources, research and portraits), with a
`.gitkeep` in each empty one so that Git keeps it. The template has no data folders: their names are the tree's, so
the start-tree skill runs this once families.yml exists. Folders that already exist are left as they are.

Usage: uv run scripts/folders.py   (or `make folders`)
"""

import dataclasses

from arbre import CONFIG, ROOT


def main():
    for role, name in dataclasses.asdict(CONFIG.paths).items():
        folder = ROOT / name
        if folder.is_dir():
            continue
        folder.mkdir(parents=True)
        (folder / ".gitkeep").touch()
        print(f"created {name}/ ({role})")


if __name__ == "__main__":
    main()
