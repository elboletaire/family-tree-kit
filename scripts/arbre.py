"""Loading and helpers shared by the tree's scripts."""

import datetime as dt
import importlib
import os
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote

import yaml

# The code (scripts/, web/) and the tree's data share the repository; ARBRE_ROOT points the scripts to the data of
# another tree (the tests use it). The data folders come from `paths` in families.yml (see below).
CODE_ROOT = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ["ARBRE_ROOT"]).resolve() if os.environ.get("ARBRE_ROOT") else CODE_ROOT

LINK_RE = re.compile(r"^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$")
WIKI_LINK_RE = re.compile(r"\[\[([^\]|#]+)(?:[|#]([^\]]*))?\]\]")
MD_LINK_RE = re.compile(r"\[([^\]]+)\]\((?!https?:)([^)\s]+?\.md)(?:#[^)]*)?\)")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CONFIDENCE = ("proven", "probable", "speculative")

PERSON_KEYS = {
    "given_name", "surnames", "aliases", "sex", "born", "birth_place", "died",
    "death_place", "occupation", "birth_order", "father", "mother",
    "parents_confidence", "siblings", "spouses", "marriages", "living", "tags", "sources", "photo",
}
# Tags that place a person in a branch: `rama/<branch key>`
BRANCH_TAG_PREFIX = "rama/"

SOURCE_KEYS = {
    "id", "title", "type", "category", "date", "place", "issuer", "subject", "pages", "status",
    "origin", "priority", "files", "drive_path", "compilation", "review", "reviewed_by",
}
SOURCE_CATEGORIES = ("genealogia", "foto", "arbol", "contexto", "patrimonio", "ia")
DEFAULT_CATEGORY = "genealogia"
# `type` of the compilations: sources that group several documents, with a table of pages → notes
COMPILATION_TYPE = "Recopilación"
# Review of what automated research found: a source without the key is trusted
REVIEW_PENDING, REVIEW_DONE = "pendiente", "revisada"
REVIEW_VALUES = (REVIEW_PENDING, REVIEW_DONE)
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def sub_links(text, fn):
    """Replaces the links between notes in the body of a markdown file.

    Accepts relative markdown links (`[text](../people/slug.md)`, the repository's format) and Obsidian
    wikilinks (`[[slug]]`). `fn(name, label, href)` receives the note name (without folder or extension), the link
    text (None in a wikilink without text) and the path (None in wikilinks), and returns the replacement.
    """
    text = WIKI_LINK_RE.sub(lambda m: fn(m.group(1).strip(), m.group(2), None), text)
    return MD_LINK_RE.sub(lambda m: fn(Path(unquote(m.group(2))).stem, m.group(1), m.group(2)), text)


class FrontmatterError(ValueError):
    pass


def split_frontmatter(text):
    if not text.startswith("---\n"):
        raise FrontmatterError("missing frontmatter (the file must start with ---)")
    end = text.find("\n---", 4)
    if end == -1:
        raise FrontmatterError("unclosed frontmatter")
    meta = yaml.safe_load(text[4:end]) or {}
    if not isinstance(meta, dict):
        raise FrontmatterError("the frontmatter is not a YAML mapping")
    return meta, text[end + 4:].lstrip("\n")


def unlink(value):
    """'[[slug]]' -> 'slug'. Returns None if it is not a wikilink."""
    if not isinstance(value, str):
        return None
    m = LINK_RE.match(value.strip())
    return m.group(1).strip() if m else None


# --- Dates ----------------------------------------------------------------
# Accepted formats (they are data, so they stay in Spanish): 1896-12-19 | 1896-12 | 1896 | "c. 1844"
# | "antes de 1938-07-06" | "después de 1900" | "¿1938-07-06?" (doubtful) | "?" (unknown)

DATE_ABOUT, DATE_BEFORE, DATE_AFTER = "c. ", "antes de ", "después de "
DATE_DOUBTFUL_OPEN, DATE_DOUBTFUL_CLOSE, DATE_UNKNOWN = "¿", "?", "?"


@dataclass
class Date:
    qualifier: str  # exact | about | before | after | doubtful | unknown
    year: int | None = None
    month: int | None = None
    day: int | None = None

    def sort_key(self):
        return (self.year or 0, self.month or 0, self.day or 0)

    def __str__(self):
        if self.qualifier == "unknown":
            return DATE_UNKNOWN
        s = f"{self.year:04d}"
        if self.month:
            s += f"-{self.month:02d}"
            if self.day:
                s += f"-{self.day:02d}"
        return {"exact": s, "about": f"{DATE_ABOUT}{s}", "before": f"{DATE_BEFORE}{s}",
                "after": f"{DATE_AFTER}{s}", "doubtful": f"{DATE_DOUBTFUL_OPEN}{s}{DATE_DOUBTFUL_CLOSE}"}[self.qualifier]


_ISO = re.compile(r"^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$")
_PREFIXES = ((DATE_ABOUT, "about"), (DATE_BEFORE, "before"), (DATE_AFTER, "after"))


def parse_date(value):
    if value is None:
        return None
    if isinstance(value, dt.date):
        return Date("exact", value.year, value.month, value.day)
    s = str(value).strip()
    if s == DATE_UNKNOWN:
        return Date("unknown")
    qualifier = "exact"
    for prefix, q in _PREFIXES:
        if s.startswith(prefix):
            qualifier, s = q, s[len(prefix):].strip()
            break
    else:
        if s.startswith(DATE_DOUBTFUL_OPEN) and s.endswith(DATE_DOUBTFUL_CLOSE):
            qualifier, s = "doubtful", s[1:-1].strip()
    m = _ISO.match(s)
    if not m:
        raise ValueError(f"invalid date: {value!r}")
    y, mo, d = (int(g) if g else None for g in m.groups())
    if mo and not 1 <= mo <= 12:
        raise ValueError(f"invalid month: {value!r}")
    if d:
        dt.date(y, mo, d)  # raises ValueError if the day does not exist
    return Date(qualifier, y, mo, d)


# --- People ---------------------------------------------------------------

@dataclass
class Person:
    slug: str
    path: Path
    meta: dict
    body: str
    children: list = field(default_factory=list)

    def get_link(self, key):
        return unlink(self.meta.get(key))

    def get_links(self, key):
        return [s for s in (unlink(v) for v in (self.meta.get(key) or [])) if s]

    @property
    def father(self):
        return self.get_link("father")

    @property
    def mother(self):
        return self.get_link("mother")

    @property
    def spouses(self):
        return self.get_links("spouses")

    @property
    def siblings(self):
        return self.get_links("siblings")

    @property
    def sources(self):
        return self.get_links("sources")

    @property
    def living(self):
        return self.meta.get("living") is True

    @property
    def sex(self):
        return self.meta.get("sex") or "U"

    @property
    def name(self):
        given = self.meta.get("given_name") or "N. N."
        return " ".join(x for x in (given, self.meta.get("surnames") or "") if x)

    def date(self, key):
        try:
            return parse_date(self.meta.get(key))
        except ValueError:
            return None

    def marriage(self, spouse_slug):
        for m in self.meta.get("marriages") or []:
            if isinstance(m, dict) and m.get("spouse") == spouse_slug:
                return m
        return None

    @property
    def photo(self):
        """Absolute path of the portrait (`photo` field, relative to the root), or None."""
        v = self.meta.get("photo")
        return (ROOT / v) if v else None

    def lifespan(self):
        b, d = self.date("born"), self.date("died")
        if not b and not d:
            return ""
        return f"{b or ''} – {d or ''}".strip()


def load_people():
    """Returns (people: dict slug->Person, errors: list[(path, msg)])."""
    people, errors = {}, []
    for path in sorted(PEOPLE_DIR.glob("*.md")):
        try:
            meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
        except (FrontmatterError, yaml.YAMLError) as e:
            errors.append((path, str(e)))
            continue
        people[path.stem] = Person(path.stem, path, meta, body)
    for p in people.values():
        for parent in (p.father, p.mother):
            if parent in people:
                people[parent].children.append(p.slug)
    for p in people.values():
        p.children.sort(key=lambda s: (people[s].meta.get("birth_order") or 99,
                                       (people[s].date("born") or Date("unknown")).sort_key()))
    return people, errors


def load_sources():
    sources = {}
    for path in sorted(SOURCES_DIR.glob("*.md")):
        try:
            meta, body = split_frontmatter(path.read_text(encoding="utf-8"))
        except (FrontmatterError, yaml.YAMLError):
            meta, body = {}, path.read_text(encoding="utf-8")
        sources[path.stem] = {"meta": meta, "body": body}
    return sources


def source_files(meta):
    """Absolute paths of a source's originals (`files` field, relative to the sources folder)."""
    return [SOURCES_DIR / f for f in (meta.get("files") or []) if isinstance(f, str)]


def all_note_names():
    """Names of every note in the repository, to resolve the wikilinks of the body."""
    return {p.stem for p in ROOT.rglob("*.md")
            if not any(part.startswith(".") or part == "build" for part in p.relative_to(ROOT).parts)}


def families(people):
    """Groups people into GEDCOM-style families.

    Returns a list of dicts {husb, wife, children, marriage, siblings_only}: one per couple of parents (even if
    one is missing), one per marriage without children and one per group of siblings with unknown parents.
    """
    fams = {}

    def key(a, b):
        return (a, b)

    for p in people.values():
        if p.father or p.mother:
            f = fams.setdefault(key(p.father, p.mother),
                                {"husb": p.father, "wife": p.mother, "children": []})
            f["children"].append(p.slug)
    for p in people.values():
        for s in p.spouses:
            if s not in people:
                continue
            h, w = (p.slug, s) if p.sex == "M" or people[s].sex == "F" else (s, p.slug)
            fams.setdefault(key(h, w), {"husb": h, "wife": w, "children": []})
    for f in fams.values():
        f["siblings_only"] = False
        m = None
        if f["husb"] in people and f["wife"]:
            m = people[f["husb"]].marriage(f["wife"])
        f["marriage"] = m
        f["children"].sort(key=lambda s: (people[s].meta.get("birth_order") or 99,
                                          (people[s].date("born") or Date("unknown")).sort_key()))
    # Siblings without known parents
    seen = set()
    for p in people.values():
        if p.father or p.mother or not p.siblings or p.slug in seen:
            continue
        group = sorted({p.slug, *[s for s in p.siblings if s in people]})
        seen.update(group)
        fams[("siblings", group[0])] = {"husb": None, "wife": None, "children": group,
                                        "marriage": None, "siblings_only": True}
    return list(fams.values())


# --- Families ---------------------------------------------------------------
# Families, branches and their founders live in families.yml (at the root), not in the code. The research
# documents are split between those families and two shared sections: «Afecta a varias familias» (`several`)
# and «General». revision.md, the web and the report use them.

CONFIG_PATH = ROOT / "families.yml"
SEVERAL, GENERAL = "several", "general"
# «All» option of the web and the report; `todo` is its former name, still accepted
ALL, ALL_LEGACY = "all", "todo"
# `##` titles of the shared sections in the research documents (content: the files use them as they are)
SHARED_TITLE = {SEVERAL: "Afecta a varias familias", GENERAL: "General"}
# Keys a family cannot have: the shared sections and the «All» option
RESERVED_KEYS = {SEVERAL, GENERAL, ALL, ALL_LEGACY}
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
# Languages with texts for the family: one scripts/i18n_<language>.py each (and its web/src/i18n/<language>.ts)
LANGUAGES = tuple(sorted(f.stem.removeprefix("i18n_") for f in Path(__file__).parent.glob("i18n_*.py")))
DEFAULT_LANGUAGE = "es"
# Data folders by role, with their default names. Each one is a folder at the root, so the notes link to each other
# as `../<folder>/<name>.md`
DEFAULT_PATHS = {"people": "people", "sources": "sources", "research": "research", "portraits": "portraits"}
FOLDER_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]*$")


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Family:
    key: str
    label: str   # short name (web selector)
    title: str   # `##` title of its section in the research documents
    of: str      # «de la familia de …», to count its documents
    default: bool


@dataclass(frozen=True)
class Branch:
    key: str
    label: str
    color: str
    founder: str | None = None
    family: str | None = None


@dataclass(frozen=True)
class Paths:
    people: str
    sources: str
    research: str
    portraits: str


@dataclass(frozen=True)
class Config:
    main: str
    families: tuple
    branches: tuple
    other_branch: Branch
    groups: tuple  # (family, title, frozenset of branches)
    language: str = DEFAULT_LANGUAGE
    paths: Paths = Paths(**DEFAULT_PATHS)

    @property
    def default_family(self):
        return next(f.key for f in self.families if f.default)


def load_config(path=CONFIG_PATH):
    """Reads families.yml and checks it is consistent; raises ConfigError if not.

    scripts/validate.py checks that the founders and `main` exist as people.
    """
    if not path.is_file():
        raise ConfigError("it does not exist: create it from families.example.yml "
                          "(see .agents/skills/start-tree/SKILL.md)")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as e:
        raise ConfigError(str(e)) from e
    if not isinstance(raw, dict):
        raise ConfigError("not a YAML mapping")

    def text(obj, key, where):
        v = obj.get(key) if isinstance(obj, dict) else None
        if not isinstance(v, str) or not v.strip():
            raise ConfigError(f"{where}: missing «{key}» (text)")
        return v.strip()

    def entries(key):
        v = raw.get(key)
        if not isinstance(v, list) or not v:
            raise ConfigError(f"missing list «{key}»")
        return v

    families = tuple(
        Family(text(f, "key", f"families[{i}]"), text(f, "label", f"families[{i}]"),
               text(f, "title", f"families[{i}]"), text(f, "of", f"families[{i}]"), f.get("default") is True)
        for i, f in enumerate(entries("families")))
    keys = [f.key for f in families]
    if len(set(keys)) != len(keys):
        raise ConfigError("families: repeated keys")
    if bad := [k for k in keys if k in RESERVED_KEYS or not SLUG_RE.match(k)]:
        raise ConfigError(f"families: invalid key: {', '.join(bad)}")
    if sum(f.default for f in families) != 1:
        raise ConfigError("families: exactly one must have `default: true`")

    def branch(b, where, full=True):
        out = Branch(text(b, "key", where), text(b, "label", where), text(b, "color", where),
                     text(b, "founder", where) if full else None, text(b, "family", where) if full else None)
        if not COLOR_RE.match(out.color):
            raise ConfigError(f"{where}: invalid color «{out.color}» (expected #rrggbb)")
        if full and out.family not in keys:
            raise ConfigError(f"{where}: unknown family «{out.family}»")
        return out

    branches = tuple(branch(b, f"branches[{i}]") for i, b in enumerate(entries("branches")))
    other = branch(raw.get("other_branch"), "other_branch", full=False)
    bkeys = [b.key for b in branches] + [other.key]
    if len(set(bkeys)) != len(bkeys):
        raise ConfigError("branches: repeated keys")

    groups = []
    for i, g in enumerate(entries("groups")):
        where = f"groups[{i}]"
        fam, title = text(g, "family", where), text(g, "title", where)
        if fam not in keys:
            raise ConfigError(f"{where}: unknown family «{fam}»")
        members = g.get("branches")
        if not isinstance(members, list) or not members:
            raise ConfigError(f"{where}: missing list «branches»")
        if unknown := [b for b in members if b not in bkeys]:
            raise ConfigError(f"{where}: unknown branches: {', '.join(map(str, unknown))}")
        groups.append((fam, title, frozenset(members)))

    language = raw.get("language", DEFAULT_LANGUAGE)
    if language not in LANGUAGES:
        raise ConfigError(f"language: unknown «{language}» (available: {', '.join(LANGUAGES)})")
    paths = raw.get("paths") or {}
    if not isinstance(paths, dict):
        raise ConfigError("paths: expected a mapping (role: folder)")
    if unknown := sorted(map(str, set(paths) - set(DEFAULT_PATHS))):
        raise ConfigError(f"paths: unknown keys: {', '.join(unknown)} (valid: {', '.join(DEFAULT_PATHS)})")
    folders = {k: paths.get(k, default) for k, default in DEFAULT_PATHS.items()}
    for k, v in folders.items():
        if not isinstance(v, str) or not FOLDER_RE.match(v):
            raise ConfigError(f"paths.{k}: «{v}» is not the name of a folder at the root")
    if len(set(folders.values())) != len(folders):
        raise ConfigError("paths: two roles share the same folder")
    return Config(text(raw, "main", path.name), families, branches, other, tuple(groups), language, Paths(**folders))


try:
    CONFIG = load_config()
except ConfigError as e:
    raise SystemExit(f"{CONFIG_PATH.name}: {e}") from e

# Texts the family reads, in the tree's language
i18n = importlib.import_module(f"i18n_{CONFIG.language}")
PEOPLE_DIR = ROOT / CONFIG.paths.people
SOURCES_DIR = ROOT / CONFIG.paths.sources
RESEARCH_DIR = ROOT / CONFIG.paths.research
PORTRAITS_DIR = ROOT / CONFIG.paths.portraits
FAMILIES = tuple(f.key for f in CONFIG.families)
DEFAULT_FAMILY = CONFIG.default_family
# `##` titles of the sections of the research documents
FAMILY_TITLE = {**{f.key: f.title for f in CONFIG.families}, **SHARED_TITLE}
BRANCHES = CONFIG.branches
OTHER_BRANCH = CONFIG.other_branch
BRANCH_FAMILY = {b.key: b.family for b in BRANCHES}
# Subsections of each family in the research documents: (family, title, branches)
BRANCH_GROUPS = CONFIG.groups

# Coordinates of the places, as they are written in the notes (see scripts/geocode.py)
PLACES_PATH = ROOT / "places.yml"



# --- Places ---------------------------------------------------------------

def person_places(person):
    """Places of a person's facts, as they are written: birth, death and each marriage."""
    m = person.meta
    out = [m.get("birth_place"), m.get("death_place")]
    out += [x.get("place") for x in (m.get("marriages") or []) if isinstance(x, dict)]
    return [str(v).strip() for v in out if v and str(v).strip()]


def used_places(people, sources):
    """{place as written: number of facts} of the whole tree: people's facts and the `place` of the sources."""
    counts = {}
    for p in people.values():
        for place in person_places(p):
            counts[place] = counts.get(place, 0) + 1
    for src in sources.values():
        place = str(src["meta"].get("place") or "").strip()
        if place:
            counts[place] = counts.get(place, 0) + 1
    return counts


def load_places(path=PLACES_PATH):
    """Reads places.yml: ({place: {"lat", "lon", "name"} or {"skip": True} or {} (not found)}, errors)."""
    if not path.is_file():
        return {}, []
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as e:
        return {}, [str(e)]
    if not isinstance(raw, dict):
        return {}, ["not a YAML mapping (place: {lat, lon})"]
    places, errors = {}, []
    for key, v in raw.items():
        v = v if v is not None else {}
        if not isinstance(v, dict) or set(v) - {"lat", "lon", "name", "skip"}:
            errors.append(f"«{key}»: expected {{lat, lon, name}}, {{skip: true}} or {{}}")
            continue
        entry = {}
        if v.get("skip") is True:
            entry["skip"] = True
        elif "lat" in v or "lon" in v:
            lat, lon = v.get("lat"), v.get("lon")
            if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (lat, lon)) \
                    or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                errors.append(f"«{key}»: lat and lon must be numbers (degrees)")
                continue
            entry = {"lat": float(lat), "lon": float(lon), "name": str(v.get("name") or key)}
        places[str(key)] = entry
    return places, errors


def _slug_text(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def branch_of(people, slug, seen=()):
    """A person's branch: the one of their paternal (or maternal) line up to a founder, or None."""
    founders = {b.founder: b.key for b in BRANCHES}
    p = people[slug]
    if slug in founders:
        return founders[slug]
    for s in p.siblings:
        if s in founders:
            return founders[s]
    for parent in (p.father, p.mother):
        if parent in people and parent not in seen:
            b = branch_of(people, parent, (*seen, slug))
            if b:
                return b
    return None


def person_families(people):
    """{slug: set of family keys (those of families.yml)} for each person.

    First by their `rama/` tags; whoever has none, by the people they are joined to (spouses, parents, children,
    siblings), in rounds until nothing changes; and whoever still has no family, by their surnames (those of the
    branch keys). Someone with tags of two families (the child of a marriage between both) belongs to both; their
    spouse, if they have their own tags, still belongs only to their own, so a family does not spread to the
    other's (the propagation only reaches people without tags).
    """
    out = {}
    for slug, p in people.items():
        tags = {str(t).split("/", 1)[1] for t in (p.meta.get("tags") or []) if str(t).startswith(BRANCH_TAG_PREFIX)}
        fams = {BRANCH_FAMILY[t] for t in tags if t in BRANCH_FAMILY}
        if fams:
            out[slug] = fams

    def spread():
        while True:
            new = {}
            for slug, p in sorted(people.items()):
                if slug in out:
                    continue
                fams = set()
                for o in (*p.spouses, p.father, p.mother, *p.children, *p.siblings):
                    fams |= out.get(o, set())
                if fams:
                    new[slug] = fams
            if not new:
                return
            out.update(new)

    spread()
    by_length = sorted(BRANCH_FAMILY, key=len, reverse=True)
    for slug, p in sorted(people.items()):
        if slug not in out:
            surnames = _slug_text(str(p.meta.get("surnames") or ""))
            b = next((b for b in by_length if surnames == b or surnames.startswith(b + "-")), None)
            if b:
                out[slug] = {BRANCH_FAMILY[b]}
    spread()
    return out


def person_group(people, slug, families):
    """(family, subsection title) of a person, by their branch or their spouse's."""
    b = branch_of(people, slug) or next(
        (x for x in (branch_of(people, s) for s in people[slug].spouses if s in people) if x), None)
    for fam, label, branches in BRANCH_GROUPS:
        if b in branches:
            return fam, label
    fam = sorted(families.get(slug, {GENERAL}))[0]
    return fam, i18n.OTHER_FAMILIES_GROUP


def family_of_people(slugs, families):
    """Family of a set of people (those cited by a document).

    Only people of a single family count (someone in two does not tip the balance): the one with most wins; on a
    tie, `several`. Without people of any family, `general`.
    """
    count = dict.fromkeys(FAMILIES, 0)
    several = False
    for s in slugs:
        fams = families.get(s, set())
        if len(fams) == 1:
            count[next(iter(fams))] += 1
        elif fams:
            several = True
    top = max(count.values())
    winners = [f for f in FAMILIES if count[f] == top]
    if top and len(winners) == 1:
        return winners[0]
    return SEVERAL if (top or several) else GENERAL


def family_sections(text):
    """Splits a markdown file into [(family, chunk)] by its level-2 headings.

    The initial chunk (title and introduction) goes with family None; headings that are not a family's, with
    `general`. Used by the web (to show a single family) and the report.
    """
    out = []
    for chunk in re.split(r"(?m)^(?=## )", text):
        if not chunk.startswith("## "):
            if chunk.strip():
                out.append((None, chunk))
            continue
        title = chunk.split("\n", 1)[0][3:].strip()
        out.append((next((k for k, label in FAMILY_TITLE.items() if title.startswith(label)), GENERAL), chunk))
    return out


# --- Generated references ---------------------------------------------------
# The person-document relation is only written in the person's `sources`. From there two sections are
# generated (between markers, not edited by hand): «Referencias» in each person and «Personas mencionadas» in
# each source. `make refs` regenerates them. The markers are part of the notes, so they stay as they are.

REFS_START = "<!-- referencias:inicio (generado con `make refs`; no editar a mano) -->"
REFS_END = "<!-- referencias:fin -->"
REFS_BLOCK_RE = re.compile(r"\n*## [^\n]+\n+" + re.escape(REFS_START) + r".*?" + re.escape(REFS_END) + r"\n*", re.S)


def strip_refs_block(text):
    """Removes the generated section (so it is not shown twice in HTML or GEDCOM)."""
    return REFS_BLOCK_RE.sub("\n", text).rstrip() + "\n"


def with_refs_block(text, heading, lines):
    """Returns `text` with the generated section at the end (replacing the previous one)."""
    base = strip_refs_block(text).rstrip()
    if not lines:
        return base + "\n"
    return f"{base}\n\n## {heading}\n\n{REFS_START}\n" + "\n".join(lines) + f"\n{REFS_END}\n"


def source_label(sid, meta):
    title = meta.get("title")
    return f"{sid} — {title}" if title else sid


def source_href(sid):
    """Link to a source from any other note (they are all one folder below the root)."""
    return f"../{CONFIG.paths.sources}/{sid}.md"


def person_href(slug):
    return f"../{CONFIG.paths.people}/{slug}.md"


def person_refs_lines(person, sources):
    return [f"- [{source_label(s, sources[s]['meta'])}]({source_href(s)})"
            for s in person.sources if s in sources]


def source_refs_lines(sid, people):
    cited = sorted((p for p in people.values() if sid in p.sources), key=lambda p: p.name)
    return [f"- [{p.name}]({person_href(p.slug)})" + (f" ({p.lifespan()})" if p.lifespan() else "")
            for p in cited]


# --- Review -----------------------------------------------------------------
# The sources found by automated research come in with `review: pendiente`. From there each person's state is
# deduced and revision.md (in the research folder) is generated (with `make refs`).

REVISION_PATH = RESEARCH_DIR / "revision.md"
# A person's review state: all their sources are pending (`new`) or some are (`partial`)
PERSON_NEW, PERSON_PARTIAL = "new", "partial"


def is_pending(sid, sources):
    return sid in sources and sources[sid]["meta"].get("review") == REVIEW_PENDING


def person_review(person, sources, shown=None):
    """PERSON_NEW if all their sources are pending, PERSON_PARTIAL if some is, or None. With `shown`, only those
    sources count (the public version's)."""
    own = [s for s in person.sources if s in sources and (shown is None or s in shown)]
    pending = [s for s in own if is_pending(s, sources)]
    if not pending:
        return None
    return PERSON_NEW if len(pending) == len(own) else PERSON_PARTIAL


def pending_sources(people, sources):
    """[(sid, meta, [(person, would be left without sources)])] of the pending sources."""
    out = []
    for sid, src in sources.items():
        if not is_pending(sid, sources):
            continue
        cited = sorted((p for p in people.values() if sid in p.sources), key=lambda p: p.name)
        out.append((sid, src["meta"], [(p, [s for s in p.sources if s in sources] == [sid])
                                       for p in cited]))
    return out


def source_family(people, sources, sid, families):
    """(family, subsection) of a document according to the people who cite it.

    If nobody cites it, the people citing the documents it mentions count. The subsection is the most repeated
    group of branches among the people of that family (on a tie, the first of BRANCH_GROUPS); None for
    `several` and `general`.
    """
    cited = [p.slug for p in people.values() if sid in p.sources]
    if not cited:
        src = sources[sid]
        refs = set(re.findall(r"\bF\d{3}\b", f"{src['meta'].get('origin') or ''} {src['body']}")) - {sid}
        cited = [p.slug for p in people.values() if refs & set(p.sources)]
    fam = family_of_people(cited, families)
    if fam not in FAMILIES:
        return fam, None
    order = [label for f, label, _ in BRANCH_GROUPS if f == fam] + [i18n.OTHER_FAMILIES_GROUP]
    count = {}
    for s in cited:
        if families.get(s) == {fam}:
            label = person_group(people, s, families)[1]
            count[label] = count.get(label, 0) + 1
    return fam, max(order, key=lambda label: (count.get(label, 0), -order.index(label)))


def revision_markdown(people, sources, hide_dates=lambda p: False):
    """revision.md of the research folder; `hide_dates(p)` hides the dates (living people in the public version).

    Documents are grouped by family (those of families.yml and, apart, several) and, within each one, by branches,
    according to the people who cite them.
    """
    pend = pending_sources(people, sources)
    families = person_families(people)
    affected = {p.slug: p for _, _, cited in pend for p, _ in cited}
    new = sorted((p for p in affected.values() if person_review(p, sources) == PERSON_NEW),
                 key=lambda p: p.name)
    placed = {}
    for sid, meta, cited in pend:
        fam, group = source_family(people, sources, sid, families)
        placed.setdefault(fam, {}).setdefault(group, []).append((sid, meta, cited))

    def new_family(p):
        fams = families.get(p.slug, set())
        return SEVERAL if len(fams) > 1 else next(iter(fams), GENERAL)

    of = {**{x.key: x.of for x in CONFIG.families}, SEVERAL: i18n.SEVERAL_OF, GENERAL: i18n.GENERAL_OF}
    split = [f"{len([x for g in placed[f].values() for x in g])} " + of[f] for f in FAMILY_TITLE if f in placed]
    lines = [
        i18n.REVISION_TITLE,
        "",
        i18n.REVISION_GENERATED,
        "",
        *i18n.revision_intro(CONFIG.paths.sources),
        "",
        i18n.revision_split_intro(f.title for f in CONFIG.families),
        "",
        i18n.revision_summary(i18n.pending_docs(len(pend)), i18n.join_and(split), len(affected), len(new)),
        "",
    ]

    def source_lines(sid, meta, cited, level):
        out = [f"{'#' * level} [{source_label(sid, meta)}]({source_href(sid)})", ""]
        out += [i18n.REVISION_DOCUMENT.format(sid=sid, href=source_href(sid))]
        info = [x for x in (str(meta.get("date") or ""), meta.get("issuer") or "") if x]
        if info:
            out += [i18n.REVISION_DATE_ORIGIN.format(" · ".join(info))]
        if meta.get("origin"):
            out += [i18n.REVISION_FOUND.format(meta["origin"])]
        if cited:
            out += [i18n.REVISION_PEOPLE]
            for p, alone in cited:
                life = f" ({p.lifespan()})" if p.lifespan() and not hide_dates(p) else ""
                out += [f"  - [{p.name}]({person_href(p.slug)}){life}"
                        + (i18n.REVISION_LEFT_WITHOUT if alone else "")]
        else:
            out += [i18n.REVISION_NOT_CITED]
        return out + [""]

    for fam, title in FAMILY_TITLE.items():
        groups = placed.get(fam, {})
        people_new = [p for p in new if new_family(p) == fam]
        if not groups and not people_new:
            continue
        total = sum(len(g) for g in groups.values())
        lines += [f"## {title}", "", f"**{i18n.pending_docs(total)}.**" if total else i18n.REVISION_NO_DOCS, ""]
        order = [label for f, label, _ in BRANCH_GROUPS if f == fam] + [i18n.OTHER_FAMILIES_GROUP, None]
        for group in sorted(groups, key=order.index):
            level = 3
            if group:
                lines += [f"### {group} ({len(groups[group])})", ""]
                level = 4
            for sid, meta, cited in groups[group]:
                lines += source_lines(sid, meta, cited, level)
        if people_new:
            lines += [i18n.REVISION_NEW_PEOPLE, "", i18n.REVISION_NEW_PEOPLE_INTRO, ""]
            lines += [f"- [{p.name}]({person_href(p.slug)})" for p in people_new] + [""]
    return "\n".join(lines)


def generated_files(people, sources):
    """{path: expected content} of every note with its generated section."""
    out = {REVISION_PATH: revision_markdown(people, sources)}
    for p in people.values():
        text = p.path.read_text(encoding="utf-8")
        out[p.path] = with_refs_block(text, i18n.REFS_HEADING_PERSON, person_refs_lines(p, sources))
    for sid in sources:
        path = SOURCES_DIR / f"{sid}.md"
        text = path.read_text(encoding="utf-8")
        out[path] = with_refs_block(text, i18n.REFS_HEADING_SOURCE, source_refs_lines(sid, people))
    return out
