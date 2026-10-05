#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml", "markdown", "pillow", "pymupdf"]
# ///
"""Builds the tree's website, in three folders of build/:

- web/: the whole tree, index.html (data and code included) and media/ (thumbnails and previews of photos and
  documents). It opens in any browser, without a server.
- public/: the public version of the site (see privacy.py): index.html without any data of the living, and only the
  media it shows, with opaque names. leak_check.py goes through it before it is written: if it finds a living person's
  data or a private document's name, the build fails and the previous version stays.
- private/: data.json, the whole tree, and its media, which deploy/server.py serves only with a session.

The thumbnails are generated once in build/media-cache and linked from each folder.

Usage: uv run scripts/build_site.py [-o build/web] [--public build/public] [--private build/private]
                                    [--only local|site] [--main slug] [--originals url]

`--main` is the person through whose eyes the web opens; by default, the `main` of families.yml. `--originals` is
where the whole web links the originals (e.g. `sources/`, for a copy of them next to it, as the published demo does);
by default, their path relative to the web's folder.
"""

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import sys
import xml.etree.ElementTree as etree
from pathlib import Path

import markdown
from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor
from markdown.util import AtomicString
import pymupdf
from PIL import Image, ImageOps

import history
import leak_check
import share_image
from arbre import (BRANCHES, CODE_ROOT, COMPILATION_TYPE, CONFIG, DEFAULT_CATEGORY, HISTORIC_EVENTS, IMAGE_EXT,
                   OTHER_BRANCH, PLACES_PATH, RESEARCH_DIR, ROOT, SOURCES_DIR, URL_RE, branch_of, family_sections, i18n,
                   is_pending, load_people, load_places, load_sources, parse_date, person_families, person_review,
                   revision_markdown, source_family, source_files, strip_refs_block, sub_links, trim_url)
from privacy import public_view

# The interface (TypeScript, in web/) is compiled separately with `make web`: here the bundle is only embedded
WEB = CODE_ROOT / "web"
BUNDLE = [WEB / "dist" / "web.js", WEB / "dist" / "web.css"]
BUILD = ROOT / "build"
# Research documents shown in the web: their names are also the `r:` panels of the web's hash
RESEARCH_NOTES = ("incoherencias", "pendientes")
REVISION_NOTE = "revision"
# Portraits keep the name of their folder (`paths.portraits`) inside media/
PORTRAITS_MEDIA = CONFIG.paths.portraits
# DATA.access: the whole tree to open without a server, the public version, or the private data loaded with a session
ACCESS_FULL, ACCESS_PUBLIC, ACCESS_PRIVATE = "full", "public", "private"
# Where the site serves the private data (deploy/server.py): /private/data.json and /private/media/
PRIVATE_PREFIX, PRIVATE_DATA = "private/", "data.json"
ONLY_LOCAL, ONLY_SITE = "local", "site"


class Media:
    """Thumbnails and previews, generated once in a cache (build/media-cache) by modification time.

    Each method returns the path inside the cache, a `Cached` string: every output links those files into its own
    media/ folder (see Output) with the name it chooses.
    """

    def __init__(self, cache_dir):
        self.out = cache_dir

    def _fresh(self, src, dst):
        return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime

    def _save(self, img, dst, max_side, quality=82):
        img = ImageOps.exif_transpose(img)
        if img.mode == "P":
            img = img.convert("RGBA")  # palettes with transparency
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail((max_side, max_side))
        dst.parent.mkdir(parents=True, exist_ok=True)
        # Without EXIF or comments: the metadata of the originals (camera, dates, names) does not reach the web
        img.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)

    def cached(self, path):
        return Cached(path.relative_to(self.out).as_posix())

    def image(self, src, key, max_side):
        dst = self.out / f"{key}.jpg"
        if not self._fresh(src, dst):
            with Image.open(src) as img:
                self._save(img, dst, max_side)
        return self.cached(dst)

    def pdf(self, src, key, max_side, all_pages=False, max_pages=60):
        """Thumbnail of the first page and, if all_pages, a preview of each page.

        Returns (thumbnail, number of pages, [(thumbnail, preview) per page]).
        """
        thumb = self.out / f"{key}.jpg"
        previews = []
        with pymupdf.open(src) as doc:
            pages = doc.page_count
            wanted = range(min(pages, max_pages)) if all_pages else range(min(pages, 1))
            for n in wanted:
                t = thumb if n == 0 else self.out / f"{key}-{n + 1:03d}.jpg"
                p = self.out / f"{key}-{n + 1:03d}-p.jpg"
                if all_pages and not (self._fresh(src, t) and self._fresh(src, p)):
                    pix = doc[n].get_pixmap(dpi=110)
                    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                    self._save(img.copy(), t, max_side)
                    self._save(img, p, 1800)
                elif not self._fresh(src, t):
                    pix = doc[n].get_pixmap(dpi=60)
                    self._save(Image.frombytes("RGB", (pix.width, pix.height), pix.samples), t, max_side)
                if all_pages:
                    previews.append((self.cached(t), self.cached(p)))
        return (self.cached(thumb) if thumb.exists() else None), pages, previews


class Cached(str):
    """Path of a file of the media cache, which each output replaces with its own url."""


class Original(str):
    """Path of an original, relative to the sources folder."""


class Output:
    """A folder of the web being written: `<dir>.tmp` while it is built, which replaces `dir` at the end (so that a
    failed build, or one the leak check stops, does not leave the served folder half written).

    `media(cached)` links a file of the cache into its media/ folder and returns its url, `prefix` included (the
    private data are served from /private/). With `opaque`, the name is a hash: the public names say nothing.
    """

    def __init__(self, directory, cache, prefix="", opaque=False):
        self.dir = Path(directory).resolve()
        self.tmp = self.dir.with_name(self.dir.name + ".tmp")
        self.cache, self.prefix, self.opaque = cache, prefix, opaque
        shutil.rmtree(self.tmp, ignore_errors=True)
        self.tmp.mkdir(parents=True)

    def media(self, cached):
        name = (hashlib.sha256(cached.encode()).hexdigest()[:20] + ".jpg") if self.opaque else cached
        dst = self.tmp / "media" / name
        if not dst.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            try:
                os.link(self.cache / cached, dst)  # takes no space
            except OSError:
                shutil.copyfile(self.cache / cached, dst)
        return f"{self.prefix}media/{name}"

    def write(self, name, text):
        (self.tmp / name).write_text(text, encoding="utf-8")

    def write_bytes(self, name, data):
        (self.tmp / name).parent.mkdir(parents=True, exist_ok=True)
        (self.tmp / name).write_bytes(data)

    def commit(self):
        old = self.dir.with_name(self.dir.name + ".old")
        shutil.rmtree(old, ignore_errors=True)
        if self.dir.exists():
            self.dir.rename(old)
        self.tmp.rename(self.dir)
        shutil.rmtree(old, ignore_errors=True)

    def discard(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


def resolve(value, fn):
    """Copy of `value` (payload: dicts, lists and texts) with each Cached or Original replaced by fn(it)."""
    if isinstance(value, (Cached, Original)):
        return fn(value)
    if isinstance(value, dict):
        return {k: resolve(v, fn) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve(v, fn) for v in value]
    return value


def slugify_file(name):
    return re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()[:60]


def year_of(value):
    try:
        d = parse_date(value)
    except ValueError:
        return None
    return d.year if d and d.year else None


URL_HOST_RE = re.compile(r"^https?://[^/?#]")
# Inside them the text is not linked: links, code and the markdown's own placeholders
NO_AUTOLINK = {"a", "code", "pre", "script", "style"}


def split_urls(text):
    """Splits a plain text into (text, url) pieces: url is None for the text between the http(s) addresses."""
    parts, at = [], 0
    for m in URL_RE.finditer(text):
        url = trim_url(m.group(0))
        if not URL_HOST_RE.match(url):
            continue
        if m.start() > at:
            parts.append((text[at:m.start()], None))
        parts.append((url, url))
        at = m.start() + len(url)
    if at < len(text):
        parts.append((text[at:], None))
    return parts


class AutolinkProcessor(Treeprocessor):
    """Turns the http(s) addresses written as plain text into links, once the markdown is parsed: never inside an
    existing link nor in code."""
    def run(self, root):
        self.walk(root)

    def walk(self, el):
        if el.tag in NO_AUTOLINK:
            return
        children = list(el)
        if el.text:
            links = self.links(el.text)
            if links:
                el.text, first = links[0], links[1:]
                for i, a in enumerate(first):
                    el.insert(i, a)
        for child in children:
            self.walk(child)
            if child.tail:
                links = self.links(child.tail)
                if links:
                    child.tail = links[0]
                    at = list(el).index(child) + 1
                    for i, a in enumerate(links[1:]):
                        el.insert(at + i, a)

    @staticmethod
    def links(text):
        """None if there is no address; if there is, the leading text and the <a> elements (with their tails)."""
        parts = split_urls(text)
        if not any(url for _, url in parts):
            return None
        lead, out = "", []
        for chunk, url in parts:
            if url:
                a = etree.Element("a", {"href": url})
                a.text = AtomicString(chunk)
                out.append(a)
            elif out:
                out[-1].tail = chunk
            else:
                lead = chunk
        return [lead, *out]


class Autolink(Extension):
    def extendMarkdown(self, md):
        # After the inline patterns (20), so that links, code and emphasis are already elements
        md.treeprocessors.register(AutolinkProcessor(md), "autolink", 5)


def generations(people, main):
    """Generation of each person: breadth-first walk (parents -1, children +1, spouses and siblings the same), from 0."""
    gen = {}
    for seed in [main, *sorted(people)]:
        if seed not in people or seed in gen:
            continue
        gen[seed] = 0
        queue = [seed]
        while queue:
            cur = queue.pop(0)
            p = people[cur]
            steps = [(x, -1) for x in (p.father, p.mother)] + [(x, 1) for x in p.children] + \
                    [(x, 0) for x in (*p.spouses, *p.siblings)]
            for other, delta in steps:
                if other in people and other not in gen:
                    gen[other] = gen[cur] + delta
                    queue.append(other)
    low = min(gen.values(), default=0)
    return {k: v - low for k, v in gen.items()}


def markdown_renderer(people, sources, doc_ids):
    """Markdown -> HTML of the web, with the links to people and to the documents in `doc_ids` (the rest, as text)."""
    def md(text):
        def repl(target, label, href):
            if target in people:
                return f'<a href="#" data-person="{target}">{html.escape(label or people[target].name)}</a>'
            if target in doc_ids:
                # Citations of sources pending review are marked in the text
                pending = (f' class="cite-pending" title="{i18n.CITE_PENDING_TITLE}"'
                           if is_pending(target, sources) else "")
                return f'<a href="#" data-doc="{target}"{pending}>{html.escape(label or target)}</a>'
            return html.escape(label or target)
        body = markdown.markdown(sub_links(text, repl), extensions=["tables", Autolink()])
        # External links open in another tab so the web is not lost
        return body.replace('<a href="http', '<a target="_blank" rel="noopener noreferrer" href="http')
    return md


def top_level_items(body):
    """How many items the top-level lists of a rendered markdown have (the nested lists are part of their item)."""
    depth = count = 0
    for tag in re.findall(r"</?(?:ul|ol|li)\b", body):
        if tag in ("<ul", "<ol"):
            depth += 1
        elif tag in ("</ul", "</ol"):
            depth -= 1
        elif tag == "<li" and depth == 1:
            count += 1
    return count


def document_files(sid, meta, media):
    """Originals of a document with their thumbnails and previews, and the thumbnail of the document."""
    files, thumb = [], None
    for i, f in enumerate(source_files(meta)):
        if not f.is_file():
            continue
        key = f"{sid}/{i:03d}-{slugify_file(f.stem)}"
        entry = {"name": f.name, "url": Original(f.relative_to(SOURCES_DIR).as_posix())}
        ext = f.suffix.lower()
        try:
            if ext in IMAGE_EXT:
                entry["kind"] = "image"
                entry["thumb"] = media.image(f, key + "-t", 420)
                entry["preview"] = media.image(f, key + "-p", 1800)
            elif ext == ".pdf":
                entry["kind"] = "pdf"
                browse = meta.get("type") != COMPILATION_TYPE
                entry["thumb"], entry["pages"], pages = media.pdf(f, key + "-t", 420, all_pages=browse)
                entry["pageImages"] = [{"thumb": t, "preview": p} for t, p in pages]
            else:
                entry["kind"] = "other"
        except Exception as e:  # damaged file or odd format: it is linked anyway
            print(f"warning: could not process {f.relative_to(ROOT)}: {e}", file=sys.stderr)
            entry["kind"] = "other"
        thumb = thumb or entry.get("thumb")
        files.append(entry)
    return files, thumb


def build_payload(people, sources, main, media, view=None, changes=()):
    """DATA of the web: the whole tree or, with `view` (privacy.PublicView), only what the public version shows.
    `changes` are the raw days of history.raw_history(), for «Novedades»."""
    public = view is not None
    families = person_families(people)
    doc_ids = view.public_docs if public else set(sources)
    md = markdown_renderer(people, sources, doc_ids)
    gen = generations(people, main)
    pid = view.public_id if public else (lambda s: s)
    living = view.living if public else {}

    docs = []
    for n, (sid, src) in enumerate(sources.items(), 1):
        if sid not in doc_ids:
            continue
        meta, body = src["meta"], src["body"]
        if not public:
            print(f"[{n}/{len(sources)}] {sid}", flush=True)
        files, thumb = document_files(sid, meta, media)
        cited = sorted((p.slug for p in people.values() if sid in p.sources), key=lambda s: people[s].name)
        docs.append({
            "id": sid,
            "family": source_family(people, sources, sid, families)[0],
            "title": meta.get("title") or sid,
            "type": meta.get("type") or "",
            "category": meta.get("category") or DEFAULT_CATEGORY,
            "date": str(meta.get("date") or ""),
            "year": year_of(meta.get("date")),
            "place": meta.get("place") or "",
            "issuer": meta.get("issuer") or "",
            "status": meta.get("status") or "",
            "review": meta.get("review") or "",
            # Who reviewed it is a relative, maybe living: not in the public version
            "reviewedBy": "" if public else str(meta.get("reviewed_by") or ""),
            # Where it came from (Drive paths, names of files, who handed it over): not in the public version
            "origin": "" if public else (meta.get("origin") or ""),
            "pages": str(meta.get("pages") or ""),
            "thumb": thumb,
            # The originals (scans, PDF) always need the session: the public version keeps only the thumbnail
            "files": [] if public else files,
            "people": cited,
            "html": md(re.sub(r"\A# .*\n", "", strip_refs_block(body))),
        })

    data_people = []
    for slug, p in sorted(people.items(), key=lambda x: pid(x[0])):
        links = {
            "father": pid(p.father) if p.father in people else None,
            "mother": pid(p.mother) if p.mother in people else None,
            "spouses": [pid(s) for s in p.spouses if s in people],
            "children": [pid(s) for s in p.children],
            "siblings": [pid(s) for s in p.siblings if s in people],
            "branch": branch_of(people, slug) or OTHER_BRANCH.key,
            "gen": gen[slug],
        }
        if slug in living:
            # «Persona viva»: only their place in the tree
            data_people.append({
                "id": pid(slug), "name": i18n.LIVING_PERSON_NAME, "given": "", "surnames": "", "sex": "U",
                "born": "", "died": "", "bornYear": None, "diedYear": None, "bornApprox": False, "birthPlace": "",
                "deathPlace": "", "occupation": "", **links, "conf": "", "living": True, "photo": None,
                "marriages": [], "sources": [], "review": "", "html": "", "families": [],
            })
            continue
        m = p.meta
        own = [s for s in p.sources if s in sources and s in doc_ids]
        if public:
            body = view.biography(slug, strip_refs_block(p.body))
            text = md(re.sub(r"\A# .*\n", "", body)) if body is not None else ""
        else:
            text = md(re.sub(r"\A# .*\n", "", strip_refs_block(p.body)))
        data_people.append({
            "id": slug,
            "name": p.name,
            "given": m.get("given_name") or "",
            "surnames": m.get("surnames") or "",
            "sex": p.sex,
            "born": str(p.date("born") or ""),
            "died": str(p.date("died") or ""),
            "bornYear": year_of(m.get("born")),
            "diedYear": year_of(m.get("died")),
            "bornApprox": bool(p.date("born") and p.date("born").qualifier != "exact"),
            "birthPlace": m.get("birth_place") or "",
            "deathPlace": m.get("death_place") or "",
            "occupation": m.get("occupation") or "",
            **links,
            "conf": m.get("parents_confidence") or "",
            "living": p.living,
            "photo": media.image(p.photo, f"{PORTRAITS_MEDIA}/{slug}", 360) if p.photo and p.photo.is_file() else None,
            # A marriage with a living person is also a fact of their life
            "marriages": [
                {"spouse": pid(x.get("spouse")), "date": str(x.get("date") or ""),
                 "year": year_of(x.get("date")), "place": x.get("place") or ""}
                for x in (m.get("marriages") or []) if isinstance(x, dict) and x.get("spouse") not in living],
            "sources": own,
            "review": person_review(p, sources, doc_ids) or "",
            "html": text,
            # Families of families.yml the person belongs to (arbre.person_families), for the selector of «Novedades»
            "families": sorted(families.get(slug, ())),
        })

    def research_html(text, items=True):
        """Each family section (level-2 headings) goes in its own <section data-family>, so the web can show a
        single family."""
        out = []
        for fam, chunk in family_sections(text):
            body = md(chunk)
            if fam:
                count = (top_level_items(body) if items
                         else body.count(f"<strong>{i18n.REVISION_DOCUMENT_LABEL}</strong>"))
                body = f'<section data-family="{fam}" data-count="{count}">{body}</section>'
            out.append(body)
        return "".join(out)

    # The research documents talk about everybody, the living too: never in the public version
    research = {}
    if not public:
        for name in RESEARCH_NOTES:
            path = RESEARCH_DIR / f"{name}.md"
            if path.exists():
                research[name] = research_html(path.read_text(encoding="utf-8"))
        research[REVISION_NOTE] = research_html(revision_markdown(people, sources), items=False)

    # Coordinates of the places that the web shows (places.yml, filled in by `make places`): only those of the facts
    # that are in these data, so that the places of the living (and of the private documents) do not reach the
    # public version
    known, place_errors = load_places()
    if place_errors:
        sys.exit(f"{PLACES_PATH.name}: " + "; ".join(place_errors))
    shown = {x for p in data_people for x in (p["birthPlace"], p["deathPlace"], *(m["place"] for m in p["marriages"]))}
    shown |= {d["place"] for d in docs}
    places = {k: v for k, v in sorted(known.items()) if k in shown and "lat" in v}

    return {
        "people": data_people,
        "docs": docs,
        "branches": [{"key": b.key, "label": b.label, "color": b.color} for b in (*BRANCHES, OTHER_BRANCH)],
        "otherBranch": OTHER_BRANCH.key,
        "events": [{"from": a, "to": b, "label": l} for a, b, l in HISTORIC_EVENTS],
        "categories": i18n.CATEGORY_LABEL,
        "research": research,
        "places": places,
        # Families of families.yml, for the selector of the research documents
        "families": [{"key": f.key, "label": f.label, "title": f.title, "of": f.of, "default": f.default}
                     for f in CONFIG.families],
        "main": view.main if public else main,
        "access": ACCESS_PUBLIC if public else ACCESS_FULL,
        "publicIds": {},
        # What changed in the data, day by day (Git history): in the public version, only deceased people and public
        # documents
        "history": history.entries(changes, people, sources, view),
    }


def page(payload, share=""):
    """index.html: the template with the compiled interface and the data (and, in the public version, the tags of the
    link preview)."""
    blob = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    out = (WEB / "template.html").read_text(encoding="utf-8").replace("/*LANG*/", CONFIG.language)
    js, css = (f.read_text(encoding="utf-8") for f in BUNDLE)
    if "</script" in js.lower():  # it would close early the <script> it is embedded in
        sys.exit("web/dist/web.js contains «</script»: it cannot be embedded")
    for marker, content in (
        ("<!--SHARE-->", share),
        ("/*WEB_CSS*/", css),
        ("/*WEB_JS*/", js),
        ("/*DATA*/null", blob),
    ):
        out = out.replace(marker, content)
    return out


def link_preview(people, main_slug, view):
    """Collage of deceased people for the preview of the shared link, or None (see share_image.py)."""
    if not CONFIG.link_preview:
        return None
    try:
        slugs = share_image.pick(people, main_slug, view.living, CONFIG.share_image)
    except ValueError as e:
        sys.exit(str(e))
    if slugs and not CONFIG.site_url:
        print("link preview: no image, `site_url` is missing in families.yml")
    built = share_image.build(CONFIG.site_url, [people[s].photo for s in slugs], i18n.SHARE_TITLE,
                              i18n.SHARE_DESCRIPTION)
    if built:
        print(f"link preview: {len(slugs)} portraits of deceased people in {built[1]}")
    return built


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=str(BUILD / "web"), help="the whole web, to open without a server")
    ap.add_argument("--public", default=str(BUILD / "public"), help="public version of the site")
    ap.add_argument("--private", default=str(BUILD / "private"), help="private data of the site")
    ap.add_argument("--only", choices=(ONLY_LOCAL, ONLY_SITE),
                    help=f"{ONLY_LOCAL}: only the whole web; {ONLY_SITE}: only the public and private folders")
    ap.add_argument("--main", default=CONFIG.main)
    ap.add_argument("--originals", help="base of the links to the originals in the whole web (by default, the path "
                    "from its folder to the sources folder)")
    args = ap.parse_args(argv)
    if missing := [str(f.relative_to(CODE_ROOT)) for f in BUNDLE if not f.is_file()]:
        sys.exit(f"The compiled interface is missing ({', '.join(missing)}): run `make web`")

    people, errors = load_people()
    if errors:
        sys.exit("Some files have errors; run scripts/validate.py")
    sources = load_sources()
    main_slug = args.main if args.main in people else sorted(people)[0]
    cache = BUILD / "media-cache"
    media = Media(cache)
    changes = history.raw_history()
    print(f"history: {len(changes)} days with changes in the data" if changes else
          "history: no Git history of the data (no repository, a shallow clone or `history_months: 0`)")
    whole = build_payload(people, sources, main_slug, media, changes=changes)
    people_n, docs_n = len(whole["people"]), len(whole["docs"])

    if args.only != ONLY_SITE:
        out = Output(args.output, cache)
        def original(x):
            if args.originals is not None:
                return args.originals + x
            return os.path.relpath(SOURCES_DIR / x, out.dir).replace(os.sep, "/")
        out.write("index.html", page(resolve(whole, lambda x: out.media(x) if isinstance(x, Cached) else original(x))))
        out.commit()
        print(f"{out.dir / 'index.html'}: {people_n} people, {docs_n} documents, {len(whole['places'])} places")
    if args.only == ONLY_LOCAL:
        return

    view = public_view(people, sources, main_slug)
    # Private data, served only with a session (deploy/server.py): /private/data.json, its media in /private/media and
    # the originals in /<sources folder>/. `publicIds` lets the web keep the focus on a living person when it opens them
    private = Output(args.private, cache, prefix=PRIVATE_PREFIX)
    data = resolve({**whole, "access": ACCESS_PRIVATE, "publicIds": {v: k for k, v in view.ids.items()}},
                   lambda x: private.media(x) if isinstance(x, Cached) else f"{CONFIG.paths.sources}/{x}")
    private.write(PRIVATE_DATA, json.dumps(data, ensure_ascii=False))

    public = Output(args.public, cache, opaque=True)
    shown = build_payload(people, sources, main_slug, media, view, changes)
    preview = link_preview(people, main_slug, view)
    tags = ""
    if preview:
        data_jpg, rel, meta = preview
        public.write_bytes(rel, data_jpg)
        public.write(f"{share_image.FOLDER}/{share_image.META}", meta)
        tags = json.loads(meta)["tags"]
    public.write("index.html", page(resolve(shown, public.media), tags))
    public.write("robots.txt", "User-agent: *\nDisallow: /\n")
    found, excluded = leak_check.check(public.tmp, view)
    leak_check.report(found, excluded)
    if found:
        private.discard()
        sys.exit(f"{len(found)} leaks in the public version: it has not been written (it stays in {public.tmp} to "
                 "look into it; it is not served)")
    private.commit()
    public.commit()
    print(f"{public.dir / 'index.html'}: {len(shown['people'])} people ({len(view.living)} living, as «"
          f"{i18n.LIVING_PERSON_NAME}»), {len(shown['docs'])} of {docs_n} documents, "
          f"{len(view.hidden_bios)} biographies hidden")
    print(f"{private.dir / PRIVATE_DATA}: the whole tree")


if __name__ == "__main__":
    main(sys.argv[1:])
