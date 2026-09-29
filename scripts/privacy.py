"""What the public version of the tree may show: who counts as living, which documents are public, and the
redaction of the text of the deceased. build_site.py, export_gedcom.py and leak_check.py share it.

The rule (documented in AGENTS.md and README.md):

- A person is **living** if their note says `living: true`, or if they have no known death (no `died`) and may have
  been born less than 100 years ago: their `born` date says so (the latest day it can stand for: an approximate date
  counts APPROX_MARGIN more years, and «después de …» always counts as recent), or, without a birth date, the year
  estimated from their family (parents and children GENERATION years apart, spouses and siblings the same age, the
  dead 60 years before their death) is less than ESTIMATE_MARGIN years from the limit. Whoever has no date at all
  and nobody dated around them counts as living too (it is safer to hide), unless their note says `living: false`.
- In the public version a living person is a «Persona viva» placeholder: only their place in the tree (their links),
  with an opaque id (`living-<n>`) instead of the slug, which contains the name.
- A document is public only if it is more than 100 years old (its date, at its latest) and names no living person:
  neither among the people who cite it, nor linked in its text, nor by their name in its text or its fields. Even
  then only its note and its thumbnail are public; the originals always need the session.
- The biography of a deceased person loses the links to living people (they become «persona viva») and its research
  notes; if it still names a living person (their full name, an alias, one of their dates, a place only the living
  have, or the given name of a living relative close to them), it is hidden whole.
"""

import datetime as dt
import re
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote

from arbre import MD_LINK_RE, WIKI_LINK_RE, i18n, load_places, parse_date, sub_links
from textsearch import norm

YEARS = 100
# Years added to an approximate or doubtful birth date («c. 1925» may be 1929)
APPROX_MARGIN = 5
# Years of doubt of a birth year estimated from the family
ESTIMATE_MARGIN = 15
GENERATION = 28
# Living relatives whose given name alone hides a biography: up to this many steps (parent, child, spouse, sibling)
NEAR_STEPS = 3
LIVING_ID = "living-{}"
# Given names too short to look for alone
MIN_GIVEN = 3


def contains(haystack_norm, needle):
    """Is the normalized `needle` a whole-word part of the normalized `haystack_norm`?"""
    n = norm(needle).strip()
    return bool(n) and f" {n} " in haystack_norm


def cutoff(today):
    """The day 100 years ago: whoever was born after it may be alive."""
    try:
        return today.replace(year=today.year - YEARS)
    except ValueError:  # 29 February
        return today.replace(year=today.year - YEARS, day=28)


def latest_day(d, margin=0):
    """Last day a date can stand for («1925» is 1925-12-31), with `margin` more years; None if it has no year."""
    if not d or not d.year:
        return None
    y = d.year + margin
    if d.day:
        return dt.date(y, d.month, d.day) if not (d.month == 2 and d.day == 29) else dt.date(y, 3, 1)
    if d.month:
        nxt = dt.date(y + (d.month == 12), d.month % 12 + 1, 1)
        return nxt - dt.timedelta(days=1)
    return dt.date(y, 12, 31)


def estimate_births(people):
    """Birth year of each person: the one of their note or one deduced from their family, in several passes."""
    def own(p):
        b = p.date("born")
        if b and b.year:
            return b.year
        d = p.date("died")
        return d.year - 60 if d and d.year else None

    est = {s: y for s, p in people.items() if (y := own(p)) is not None}
    for _ in range(20):
        found = {}
        for slug, p in people.items():
            if slug in est:
                continue
            sibs = set(p.siblings)
            for parent in (p.father, p.mother):
                if parent in people:
                    sibs.update(people[parent].children)
            sibs.discard(slug)
            cands = [est[x] + GENERATION for x in (p.father, p.mother) if x in est]
            cands += [est[x] - GENERATION for x in p.children if x in est]
            cands += [est[x] for x in (*p.spouses, *sibs) if x in est]
            if cands:
                found[slug] = round(sum(cands) / len(cands))
        if not found:
            break
        est.update(found)
    return est


def living_reasons(people, today):
    """{slug: reason} of the people treated as living (see the module's rule)."""
    limit = cutoff(today)
    est = estimate_births(people)
    out = {}
    for slug, p in people.items():
        if p.living:
            out[slug] = "living: true"
            continue
        if p.meta.get("died") is not None and str(p.meta.get("died")).strip():
            continue  # known death, even without a date («?»)
        born = p.date("born")
        if born and born.qualifier == "after":
            out[slug] = f"born {born}: may be recent"
        elif born and born.year:
            margin = APPROX_MARGIN if born.qualifier in ("about", "doubtful") else 0
            if latest_day(born, margin) > limit:
                out[slug] = f"born {born}, less than {YEARS} years ago, without a death"
        elif slug not in est:
            # Nothing to deduce it from: living, unless the note says they are not
            if p.meta.get("living") is not False:
                out[slug] = "no dates and nobody dated around them"
        elif est[slug] + ESTIMATE_MARGIN > limit.year:
            out[slug] = f"no dates; birth estimated from the family c. {est[slug]}"
    return out


def note_name(href):
    """`../people/slug.md` -> `slug`, as sub_links names the notes."""
    return Path(unquote(href)).stem


def neighbours(p, people):
    sibs = set(p.siblings)
    for parent in (p.father, p.mother):
        if parent in people:
            sibs.update(people[parent].children)
    return {x for x in (p.father, p.mother, *p.children, *p.spouses, *sibs) if x in people and x != p.slug}


def within(people, slug, steps):
    """People up to `steps` links away from `slug` (without it)."""
    seen, frontier = {slug}, {slug}
    for _ in range(steps):
        frontier = {n for s in frontier for n in neighbours(people[s], people)} - seen
        seen |= frontier
    return seen - {slug}


def name_needles(p):
    """Forms of a person's name that identify them: full name, given name with each of their surnames in order, the
    aliases of more than one word, and the slug."""
    given = str(p.meta.get("given_name") or "").strip()
    surnames = str(p.meta.get("surnames") or "").split()
    out = set()
    if given and surnames:
        out.add(f"{given} {' '.join(surnames)}")
        for i in range(1, len(surnames)):
            out.add(f"{given} {' '.join(surnames[:i])}")
    for alias in p.meta.get("aliases") or []:
        if len(str(alias).split()) > 1:
            out.add(str(alias))
    out.add(p.slug.replace("-", " "))
    return {n for n in out if len(norm(n).split()) > 1}


def date_needles(value):
    """Forms of an exact or month date in the text: 1952-12-19, 19 de diciembre de 1952, 19/12/1952…"""
    try:
        d = parse_date(value)
    except ValueError:
        return set()
    if not d or not d.year or not d.month:
        return set()
    out = {f"{d.year:04d}-{d.month:02d}" + (f"-{d.day:02d}" if d.day else "")}
    month = i18n.MONTH_NAMES[d.month - 1]
    if d.day:
        out |= {i18n.long_date(d.day, month, d.year), f"{d.day}/{d.month}/{d.year}", f"{d.day:02d}/{d.month:02d}/{d.year}"}
    else:
        out.add(i18n.month_year(month, d.year))
    return out


def own_dates(p, but=()):
    """Forms of a person's dates: birth, death and marriages (but those with someone in `but`)."""
    values = [p.meta.get("born"), p.meta.get("died")]
    values += [m.get("date") for m in p.meta.get("marriages") or [] if isinstance(m, dict) and m.get("spouse") not in but]
    return {n for v in values for n in date_needles(v)}


RESEARCH_HEADING_RE = re.compile(r"(?ms)^## " + re.escape(i18n.RESEARCH_NOTES_HEADING) + r"\b.*?(?=^## |\Z)")


@dataclass
class PublicView:
    """What the public version shows, computed once from the whole tree."""
    people: dict
    sources: dict
    today: dt.date
    living: dict = field(default_factory=dict)      # slug -> reason
    ids: dict = field(default_factory=dict)         # slug -> public id
    docs: dict = field(default_factory=dict)        # sid -> None (public) or the reason it is private
    hidden_bios: dict = field(default_factory=dict)  # slug of a deceased person -> reason their biography is hidden
    main: str = ""
    needles: dict = field(default_factory=dict)     # slug of a living person -> forms of their name
    dates: dict = field(default_factory=dict)       # slug of a living person -> forms of their dates (see date_needles)
    # Forms of the name of a living person that are part of a deceased one's: they cannot be told apart
    shared_names: dict = field(default_factory=dict)  # form -> (living slug, deceased slug)
    _living_places: dict | None = None

    @property
    def public_docs(self):
        return {s for s, r in self.docs.items() if r is None}

    def public_places(self):
        """Places of the facts the public version shows: births, deaths and marriages of the deceased (not those with a
        living person) and the places of the public documents."""
        out = set()
        for slug, p in self.people.items():
            if slug in self.living:
                continue
            out |= {p.meta.get("birth_place"), p.meta.get("death_place")}
            out |= {m.get("place") for m in p.meta.get("marriages") or []
                    if isinstance(m, dict) and m.get("spouse") not in self.living}
        out |= {self.sources[s]["meta"].get("place") for s in self.public_docs}
        return {str(x) for x in out if x}

    def public_id(self, slug):
        return self.ids.get(slug, slug)

    def names_living(self, text, near=(), taken=(), own_dates=()):
        """The first living person whose name or one of whose dates appears in `text`, or None. For those in `near`,
        their given name alone counts too, unless it is in `taken` (the given names of the deceased around, whom it may
        be naming). `own_dates` are not looked for: those of the person the text is about (a twin's birth)."""
        t = norm(text)
        for slug, needles in self.needles.items():
            if any(contains(t, n) for n in needles) or any(contains(t, d) for d in self.dates[slug] - set(own_dates)):
                return slug
        for slug in near:
            given = str(self.people[slug].meta.get("given_name") or "")
            if len(given) >= MIN_GIVEN and norm(given) not in taken and contains(t, given):
                return slug
        return None

    def links_living(self, text):
        found = []
        sub_links(text, lambda name, label, href: found.append(name) or "")
        return next((x for x in found if x in self.living), None)

    def biography(self, slug, body):
        """Public body of a deceased person's note (already without the generated references), or None if hidden."""
        text = RESEARCH_HEADING_RE.sub("", body)
        text = WIKI_LINK_RE.sub(lambda m: i18n.LIVING_PERSON_TEXT if m.group(1).strip() in self.living else m.group(0), text)
        text = MD_LINK_RE.sub(lambda m: i18n.LIVING_PERSON_TEXT if note_name(m.group(2)) in self.living else m.group(0), text)
        area = within(self.people, slug, NEAR_STEPS)
        near = sorted(x for x in area if x in self.living)
        taken = {norm(self.people[x].meta.get("given_name") or "") for x in area | {slug} if x not in self.living}
        who = self.names_living(text, near, taken, own_dates(self.people[slug], self.living))
        if who:
            self.hidden_bios[slug] = f"names a living person ({self.public_id(who)})"
            return None
        t = norm(text)
        if who := next((s for s, places in self.living_places().items() if any(contains(t, x) for x in places)), None):
            self.hidden_bios[slug] = f"names a place of a living person ({self.public_id(who)})"
            return None
        return text

    def living_places(self):
        """{living slug: their places (and those places' labels on the map) that no public fact has}."""
        if self._living_places is None:
            located = load_places()[0]
            label = lambda x: (located.get(x) or {}).get("name")  # noqa: E731
            public = self.public_places()
            taken = {norm(x).strip() for x in (*public, *map(label, public)) if x}
            self._living_places = {}
            for slug in self.living:
                p = self.people[slug]
                places = [p.meta.get("birth_place"), p.meta.get("death_place")]
                places += [m.get("place") for m in p.meta.get("marriages") or [] if isinstance(m, dict)]
                forms = {str(f) for x in places if x for f in (x, label(x)) if f}
                self._living_places[slug] = {f for f in forms if norm(f).strip() not in taken}
        return self._living_places


def public_view(people, sources, main, today=None):
    today = today or dt.date.today()
    v = PublicView(people, sources, today)
    v.living = living_reasons(people, today)
    deceased = [(norm(n), s) for s in sorted(people) if s not in v.living for n in name_needles(people[s])]
    for s in sorted(v.living):
        v.needles[s] = set()
        for n in name_needles(people[s]):
            if other := next((d for form, d in deceased if contains(form, n)), None):
                v.shared_names[n] = (s, other)
            else:
                v.needles[s].add(n)
        v.dates[s] = own_dates(people[s])

    # Opaque ids, numbered in the order the living are reached from the deceased (sorted), so they do not follow the
    # alphabetical order of their names
    order, seen = [], set()
    queue = sorted(s for s in people if s not in v.living)
    rest = sorted(v.living)
    while queue or rest:
        cur = queue.pop(0) if queue else rest.pop(0)
        if cur in seen:
            continue
        seen.add(cur)
        if cur in v.living:
            order.append(cur)
        p = people[cur]
        for n in (p.father, p.mother, *p.spouses, *p.children, *p.siblings):
            if n in people and n not in seen and n in v.living:
                queue.append(n)
    v.ids = {s: LIVING_ID.format(i) for i, s in enumerate(order, 1)}

    limit = cutoff(today)
    cited = {sid: {p.slug for p in people.values() if sid in p.sources} for sid in sources}
    for sid, src in sources.items():
        meta = src["meta"]
        try:
            date = parse_date(meta.get("date"))
        except ValueError:
            date = None
        text = " ".join(str(meta.get(k) or "") for k in ("title", "place", "issuer", "subject", "origin", "drive_path"))
        text += " " + " ".join(str(f) for f in meta.get("files") or []) + " " + src["body"]
        if who := sorted(cited[sid] & set(v.living)):
            v.docs[sid] = f"cited by a living person ({v.public_id(who[0])})"
        elif who := v.links_living(src["body"]):
            v.docs[sid] = f"links a living person ({v.public_id(who)})"
        elif who := v.names_living(text):
            v.docs[sid] = f"names a living person ({v.public_id(who)})"
        elif not date or not date.year or date.qualifier in ("after", "unknown"):
            v.docs[sid] = "without a date"
        elif latest_day(date, APPROX_MARGIN if date.qualifier in ("about", "doubtful") else 0) > limit:
            v.docs[sid] = f"less than {YEARS} years old ({date})"
        else:
            v.docs[sid] = None

    # The web opens through the eyes of `main`; if they are living, through those of their closest deceased ancestor
    # (by generations; the father's line first), or else the first deceased person
    v.main = main if main in people and main not in v.living else ""
    frontier = [main] if main in people else []
    while not v.main and frontier:
        nxt = []
        for s in frontier:
            for parent in (people[s].father, people[s].mother):
                if parent in people:
                    nxt.append(parent)
        v.main = next((x for x in nxt if x not in v.living), "")
        frontier = nxt
    if not v.main:
        v.main = next((s for s in sorted(people) if s not in v.living), "")
    return v

