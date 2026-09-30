"""The preview image of the shared links (Open Graph): a collage of portraits of deceased people, and the tags that
point to it.

Only portraits of the dead go in (the ones the public version already shows), chosen from `share_image` of
families.yml or, by default, the closest ancestors of the main person that have one. A living person in the list is
an error, not something silently skipped. The image is written with no metadata and a name that is a hash of its
content, so that the platforms that keep previews in a cache see a new address when it changes.
"""

import hashlib
import html
import io
import json

from PIL import Image, ImageOps

WIDTH, HEIGHT, GUTTER = 1200, 630, 6
BACKGROUND = (250, 248, 244)  # the web's paper
MAX_TILES = 8
FOLDER = "share"
META = "meta.json"  # its `tags` are the ones deploy/server.py puts in its login page too


def ancestors(people, main, living):
    """Slugs of the deceased ancestors of `main` with a portrait, the closest first (breadth-first, father before mother)."""
    out, seen, queue = [], {main}, [main]
    while queue:
        nxt = []
        for slug in queue:
            p = people.get(slug)
            if not p:
                continue
            for parent in (p.father, p.mother):
                if parent and parent not in seen:
                    seen.add(parent)
                    nxt.append(parent)
        out += [s for s in nxt if s in people and s not in living and portrait(people[s])]
        queue = nxt
    return out


def portrait(person):
    photo = getattr(person, "photo", None)
    return photo if photo and photo.is_file() else None


def pick(people, main, living, explicit=()):
    """The slugs that go in the collage. Raises ValueError if the explicit list names a living person or one with no
    portrait."""
    if explicit:
        for slug in explicit:
            if slug not in people:
                raise ValueError(f"share_image: {slug} does not exist")
            if slug in living:
                raise ValueError(f"share_image: {slug} is a living person")
            if not portrait(people[slug]):
                raise ValueError(f"share_image: {slug} has no portrait")
        return list(explicit)[:MAX_TILES]
    return ancestors(people, main, living)[:MAX_TILES]


def rows(n):
    """Tiles per row: one row up to three, two rows from four."""
    if n <= 3:
        return [n]
    top = (n + 1) // 2
    return [top, n - top]


def collage(paths):
    """JPEG bytes (1200x630, no metadata) with the portraits cropped to fill their tile, faces a little above the centre."""
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    layout = rows(len(paths))
    top, it = 0, iter(paths)
    for r, count in enumerate(layout):
        h = (HEIGHT - GUTTER * (len(layout) - 1)) // len(layout) if r < len(layout) - 1 else HEIGHT - top
        left = 0
        for c in range(count):
            w = (WIDTH - GUTTER * (count - 1)) // count if c < count - 1 else WIDTH - left
            with Image.open(next(it)) as img:
                tile = ImageOps.fit(ImageOps.exif_transpose(img).convert("RGB"), (w, h), Image.LANCZOS, centering=(.5, .3))
            canvas.paste(tile, (left, top))
            left += w + GUTTER
        top += h + GUTTER
    out = io.BytesIO()
    canvas.save(out, "JPEG", quality=85, optimize=True)
    return out.getvalue()


def build(site_url, paths, title, description):
    """(bytes, relative path of the image, meta) or None if there is nothing to show or no address to point to."""
    if not paths or not site_url:
        return None
    data = collage(paths)
    rel = f"{FOLDER}/og-{hashlib.sha256(data).hexdigest()[:16]}.jpg"
    meta = {"title": title, "description": description, "image": f"{site_url}/{rel}", "width": WIDTH, "height": HEIGHT}
    return data, rel, json.dumps({**meta, "tags": tags(meta)}, ensure_ascii=False)


def tags(meta):
    """The <meta> tags of a link preview."""
    def one(kind, name, value):
        return f'<meta {kind}="{name}" content="{html.escape(str(value), quote=True)}">'
    return "\n".join([
        one("property", "og:type", "website"),
        one("property", "og:title", meta["title"]),
        one("property", "og:description", meta["description"]),
        one("property", "og:image", meta["image"]),
        one("property", "og:image:width", meta["width"]),
        one("property", "og:image:height", meta["height"]),
        one("name", "twitter:card", "summary_large_image"),
    ])
