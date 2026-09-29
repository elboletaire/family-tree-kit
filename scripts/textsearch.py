"""Normalization of text for whole-word search, shared by the leak check (privacy.py, leak_check.py) and the check of
the template (check_template.py). It does not depend on families.yml, so that it also works in a tree not started."""

import html
import re
import unicodedata

JSON_ESCAPE_RE = re.compile(r"\\(u[0-9a-fA-F]{4}|.)")


def norm(text):
    """Text without accents, capitals or punctuation, with single spaces around each word (for whole-word search)."""
    s = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode().lower()
    return " " + " ".join(re.findall(r"[a-z0-9]+", s)) + " "


def readable(text):
    """The text as it is read: without the escapes of JSON («\\n» would glue the next word to an «n») nor HTML."""
    text = JSON_ESCAPE_RE.sub(lambda m: chr(int(m.group(1)[1:], 16)) if len(m.group(1)) == 5 else " ", text)
    return html.unescape(text)
