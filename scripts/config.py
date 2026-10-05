#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Prints a value of families.yml, already checked and with its defaults filled in, for shell scripts (the deploy's
post-receive hook reads the sources folder with it).

Usage: uv run scripts/config.py language | main | paths.<role>   (e.g. paths.sources)
"""

import dataclasses
import sys

from arbre import CONFIG

KEYS = {"language": CONFIG.language, "main": CONFIG.main,
        **{f"paths.{k}": v for k, v in dataclasses.asdict(CONFIG.paths).items()}}


def main(argv):
    if len(argv) != 1 or argv[0] not in KEYS:
        sys.exit(f"usage: config.py {' | '.join(KEYS)}")
    # Read by shell scripts: no «\r» at the end of the line, also on Windows
    sys.stdout.reconfigure(newline="\n")
    print(KEYS[argv[0]])


if __name__ == "__main__":
    main(sys.argv[1:])
