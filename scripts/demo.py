#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["faker==40.40.0", "pillow==12.3.0"]
# ///
"""A fictional family tree, to show the engine: the published demo, the screenshots of the READMEs and a test.

It writes a complete tree into a folder (by default build/demo-tree): families.yml, places.yml and the people,
sources and research folders with their default names. Two families of Spanish villages, each with a few branches,
over six generations (from the 1830s to the 1980s): dates, occupations, marriages, a widower who marries a widow
with a child (step-siblings and half-siblings), living people (for the public version), proven and probable
parentage, sources with transcriptions and generated scans (two of them found by automated research, pending
review), and the research documents with a few items by family and branch.

The names come from Faker (es_ES) with a fixed seed, and the pinned versions of Faker and Pillow keep the output the
same byte for byte. The places are real towns, with their coordinates, so that the map works. Nobody of the tree is
real: it is not a family's data.

The notes are written without their generated sections: `scripts/references.py` adds them (`make demo` does).

Usage: uv run scripts/demo.py [folder]
"""

import argparse
import json
import math
import random
import re
import shutil
import sys
import textwrap
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from faker import Faker
from PIL import Image, ImageDraw, ImageFilter, ImageFont

CODE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = CODE_ROOT / "build" / "demo-tree"
# Left in the folder, so that a second run only replaces a folder it wrote
MARKER = ".demo-tree"
SEED = 1864
# Deaths are drawn up to this year, and whoever is born from LIVING_FROM on may still be alive: fixed, so the output
# does not depend on the day it runs. Everyone born before is dead (the 100-year rule of privacy.py counts them as
# living otherwise).
LAST_YEAR = 2024
LIVING_FROM = 1936
PATHS = {"people": "people", "sources": "sources", "research": "research", "portraits": "portraits"}
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
          "noviembre", "diciembre"]

# Real towns with their coordinates: {text as written in the notes: (lat, lon, label on the map)}
PLACES = {
    "Mondoñedo, Lugo": (43.4283, -7.3626, "Mondoñedo"),
    "Vilalba, Lugo": (43.2970, -7.6810, "Vilalba"),
    "Ribadeo, Lugo": (43.5362, -7.0404, "Ribadeo"),
    "Viveiro, Lugo": (43.6620, -7.5946, "Viveiro"),
    "Lugo": (43.0121, -7.5558, "Lugo"),
    "Betanzos, A Coruña": (43.2804, -8.2121, "Betanzos"),
    "A Coruña": (43.3623, -8.4115, "A Coruña"),
    "La Habana, Cuba": (23.1136, -82.3666, "La Habana"),
    "Úbeda, Jaén": (38.0133, -3.3706, "Úbeda"),
    "Baeza, Jaén": (37.9934, -3.4697, "Baeza"),
    "Cazorla, Jaén": (37.9102, -3.0035, "Cazorla"),
    "Jaén": (37.7796, -3.7849, "Jaén"),
    "Guadix, Granada": (37.2997, -3.1386, "Guadix"),
    "Granada": (37.1773, -3.5986, "Granada"),
    "Melilla": (35.2923, -2.9381, "Melilla"),
    "Valencia": (39.4699, -0.3763, "Valencia"),
}
# Occupations by era, (masculine, feminine)
TRADES = {
    1880: [("labrador", "labradora"), ("jornalero", "jornalera"), ("cantero", None), ("carpintero", None),
           ("tonelero", None), ("zapatero", None), ("arriero", None), (None, "costurera"), (None, "hilandera"),
           (None, "sus labores"), (None, "sus labores")],
    LIVING_FROM: [("ferroviario", None), ("maestro", "maestra"), ("comerciante", "comerciante"), ("guardia civil", None),
                  ("mecánico", None), ("panadero", "panadera"), ("marinero", None), (None, "modista"),
                  (None, "telefonista"), (None, "sus labores"), (None, "sus labores")],
    9999: [("ingeniero", "ingeniera"), ("médico", "médica"), ("profesor", "profesora"), ("abogado", "abogada"),
           ("enfermero", "enfermera"), ("funcionario", "funcionaria"), ("arquitecto", "arquitecta"),
           ("electricista", None), ("administrativo", "administrativa")],
}
BRANCH_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#b0489c", "#c9a227"]
OTHER_BRANCH = {"key": "otras", "label": "Otras familias", "color": "#9a958c"}


def slugify(text):
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def q(text):
    """A YAML string (JSON's syntax is valid YAML)."""
    return json.dumps(text, ensure_ascii=False)


def ydate(value):
    """A date for the frontmatter: ISO dates as they are, the rest («c. 1834») quoted."""
    return value if re.fullmatch(r"\d{4}(-\d\d){0,2}", value) else q(value)


def year(value):
    return int(re.search(r"\d{4}", value).group())


def spoken(value):
    """«el 4 de marzo de 1862», «en 1862» or «hacia 1834»."""
    if m := re.fullmatch(r"(\d{4})-(\d\d)-(\d\d)", value):
        return f"el {int(m[3])} de {MONTHS[int(m[2]) - 1]} de {m[1]}"
    if value.startswith("c. "):
        return f"hacia {value[3:]}"
    return f"en {value}"


def town(place):
    return place.split(",")[0]


@dataclass
class Person:
    given: str
    surnames: list
    sex: str
    born: str
    birth_place: str
    family: str
    father: "Person | None" = None
    mother: "Person | None" = None
    conf: str = "proven"
    died: str | None = None
    death_place: str | None = None
    occupation: str | None = None
    living: bool | None = None
    birth_order: int | None = None
    home: str = ""
    aliases: list = field(default_factory=list)
    siblings: list = field(default_factory=list)  # only of whoever has no known parents
    spouses: list = field(default_factory=list)
    marriages: list = field(default_factory=list)  # [(spouse, date, place)]
    children: list = field(default_factory=list)
    sources: list = field(default_factory=list)
    cites: dict = field(default_factory=dict)  # {fact: source id}: the citation of each fact of the biography
    story: list = field(default_factory=list)  # sentences of the biography besides the facts
    biography: str = ""
    notes: list = field(default_factory=list)
    tags: set = field(default_factory=set)
    infant: bool = False

    @property
    def slug(self):
        return slugify(" ".join([self.given, *self.surnames]))

    @property
    def name(self):
        return " ".join([self.given, *self.surnames])

    @property
    def year(self):
        return year(self.born)

    @property
    def link(self):
        return f"[{self.name}](../people/{self.slug}.md)"


@dataclass
class Source:
    sid: str
    title: str
    type: str
    category: str
    date: str
    place: str
    issuer: str
    intro: str
    text: str
    notes: str = ""
    status: str = "documentado"
    origin: str = ""
    review: str | None = None
    reviewed_by: str | None = None
    files: list = field(default_factory=list)  # [(file name, function that draws it)]

    @property
    def cite(self):
        return f"([{self.sid}](../sources/{self.sid}.md))"


class Demo:
    def __init__(self, seed=SEED):
        self.fake = Faker("es_ES")
        self.fake.seed_instance(seed)
        self.rng = random.Random(seed)
        self.people = []
        self.sources = []
        self.surnames = set()
        self.families = []  # [(key, founder surname, [(branch surname, founder)])]
        self.research = {"incoherencias": [], "pendientes": []}  # [(family key or None, branch key or None, text)]

    # --- people ---------------------------------------------------------------

    def surname(self):
        while True:
            s = self.fake.last_name()
            if " " not in s and len(s) >= 4 and s not in self.surnames:
                self.surnames.add(s)
                return s

    def person(self, sex, born, place, surnames, family, **kw):
        slugs = {p.slug for p in self.people}
        while True:
            given = self.fake.first_name_male() if sex == "M" else self.fake.first_name_female()
            p = Person(given, surnames, sex, born, place, family, home=place, **kw)
            if p.slug not in slugs and (p.father is None or all(given != c.given for c in p.father.children)):
                break
        p.occupation = self.trade(sex, year(born))
        self.people.append(p)
        for parent in (p.father, p.mother):
            if parent:
                parent.children.append(p)
        return p

    def trade(self, sex, y):
        for until, trades in TRADES.items():
            if y < until:
                options = [t[0 if sex == "M" else 1] for t in trades]
                return self.rng.choice([t for t in options if t])
        return None

    def date(self, y, exact=True):
        if not exact:
            return f"c. {y}"
        return f"{y}-{self.rng.randint(1, 12):02d}-{self.rng.randint(1, 28):02d}"

    def outsider(self, sex, y, place, family):
        """Someone who marries into the tree: parents not known."""
        return self.person(sex, self.date(y), place, [self.surname(), self.surname()], family)

    def founder(self, y, place, family):
        return self.person("M", self.date(y, exact=False), place, [self.surname(), self.surname()], family)

    def marry(self, a, b, y, place):
        when = self.date(y)
        for x, other in ((a, b), (b, a)):
            x.spouses.append(other)
            x.marriages.append((other, when, place))
            x.home = place
        return when

    def children(self, father, mother, start, n, place, depth, line=None, conf="proven", first=1):
        """n children of a couple, born from `start` in `place`. `line` = (index, sex): the child the tree goes on
        with, which the caller marries; the others may die as infants, stay single or, with depth > 0, marry
        someone from outside and have their own children."""
        kids, y = [], start
        for i in range(n):
            is_line = line is not None and i == line[0]
            sex = line[1] if is_line else self.rng.choice("MF")
            kid = self.person(sex, self.date(y), place, [father.surnames[0], mother.surnames[0]], father.family,
                              father=father, mother=mother, conf=conf, birth_order=first + i)
            kids.append(kid)
            y += self.rng.randint(2, 3)
            if is_line:
                continue
            if y < 1920 and self.rng.random() < 0.15:
                kid.infant = True
                kid.occupation = None
                kid.died = self.date(kid.year + self.rng.randint(0, 2))
                kid.death_place = place
            elif depth > 0 and self.rng.random() < 0.6:
                other = self.outsider("F" if sex == "M" else "M", kid.year + self.rng.randint(-3, 3), place,
                                      father.family)
                wed = kid.year + self.rng.randint(21, 27)
                self.marry(kid, other, wed, place)
                husband, wife = (kid, other) if sex == "M" else (other, kid)
                self.children(husband, wife, wed + 1, self.rng.randint(1, 3), place, depth - 1)
        return kids

    def deaths(self):
        """Death of whoever does not have one yet: after their last child and their marriages; from LIVING_FROM on,
        only some."""
        for p in self.people:
            if p.died or p.living:
                continue
            if p.year >= LIVING_FROM and self.rng.random() < 0.8:
                continue
            after = max([p.year + 45] + [c.year + 1 for c in p.children] + [year(w) + 1 for _, w, _ in p.marriages])
            dy = max(p.year + self.rng.randint(55, 94), after)
            if dy > LAST_YEAR:
                if p.year >= LIVING_FROM:
                    continue
                dy = self.rng.randint(min(after, LAST_YEAR), LAST_YEAR)
            p.died = self.date(dy)
            p.death_place = p.home

    def tag(self):
        founders = {f: key for _, _, branches in self.families for key, f in branches}

        def up(p):
            return [p] + [a for par in (p.father, p.mother) if par for a in up(par)]

        for p in self.people:
            p.tags = {founders[id(a)] for a in up(p) if id(a) in founders}

    # --- the tree ---------------------------------------------------------------

    def build(self):
        a, b = self.north(), self.south()
        # The two families meet in Valencia: the main person is their granddaughter's daughter
        self.marry(a, b, 1983, "Valencia")
        kids = self.children(a, b, 1985, 2, "Valencia", 0, line=(0, "F"))
        self.main = kids[0]
        a.living = b.living = True
        self.deaths()
        self.tag()
        self.cite_all()
        return self

    def north(self):
        """The family of the north (Lugo and A Coruña): branches of the two founders and of a third one that joins
        them; a son who went to Cuba and came back; a widower who marries a widow with a son. Returns the heir, born
        in the 1950s."""
        fam = "north"
        x1 = self.founder(1834, "Mondoñedo, Lugo", fam)
        x1w = self.outsider("F", 1838, "Mondoñedo, Lugo", fam)
        self.marry(x1, x1w, 1859, "Mondoñedo, Lugo")
        kx = self.children(x1, x1w, 1860, 4, "Mondoñedo, Lugo", 1, line=(1, "M"), conf="probable")
        x2 = kx[1]
        y1 = self.founder(1837, "Vilalba, Lugo", fam)
        y1w = self.outsider("F", 1840, "Vilalba, Lugo", fam)
        self.marry(y1, y1w, 1862, "Vilalba, Lugo")
        ky = self.children(y1, y1w, 1863, 3, "Vilalba, Lugo", 1, line=(1, "F"), conf="probable")
        y2 = ky[1]
        wed2 = self.marry(x2, y2, 1887, "Vilalba, Lugo")
        k2 = self.children(x2, y2, 1888, 4, "Ribadeo, Lugo", 1, line=(0, "M"))
        x3 = k2[0]
        v2 = self.founder(1858, "Viveiro, Lugo", fam)
        v2w = self.outsider("F", 1861, "Viveiro, Lugo", fam)
        self.marry(v2, v2w, 1884, "Viveiro, Lugo")
        kv = self.children(v2, v2w, 1886, 3, "Viveiro, Lugo", 0, line=(2, "F"))
        v3 = kv[2]
        wed3 = self.marry(x3, v3, 1914, "Viveiro, Lugo")
        k3 = self.children(x3, v3, 1915, 4, "Lugo", 1, line=(0, "M"))
        x4 = k3[0]
        # First marriage of the heir: his wife dies young
        o4 = self.outsider("F", 1919, "Lugo", fam)
        self.marry(x4, o4, 1942, "Lugo")
        k4 = self.children(x4, o4, 1943, 2, "Lugo", 0)
        o4.died, o4.death_place = self.date(1949), "Lugo"
        # The widow he marries, with the son of her first husband
        p4 = self.outsider("F", 1924, "Betanzos, A Coruña", fam)
        q4 = self.outsider("M", 1920, "Betanzos, A Coruña", fam)
        self.marry(q4, p4, 1946, "Betanzos, A Coruña")
        kq = self.children(q4, p4, 1947, 1, "Betanzos, A Coruña", 0)
        q4.died, q4.death_place = self.date(1950), "Betanzos, A Coruña"
        wed4 = self.marry(x4, p4, 1952, "A Coruña")
        k5 = self.children(x4, p4, 1953, 2, "A Coruña", 0, line=(1, "M"), first=3)
        x5 = k5[1]
        for k in k4 + kq + k5:
            k.home = "A Coruña"
        x4.died, x4.death_place = self.date(1994), "A Coruña"
        p4.died, p4.death_place = self.date(2009), "A Coruña"
        # A brother of the one who went to Cuba followed him and stayed there
        for cuban in [k for k in k2[1:] if not k.infant and not k.spouses][:1]:
            cuban.home = "La Habana, Cuba"
            cuban.story.append(f"Siguió a su hermano {x3.given} a Cuba y ya no volvió.")

        self.families.append((fam, x1.surnames[0], [(slugify(x1.surnames[0]), id(x1)),
                                                     (slugify(y1.surnames[0]), id(y1)),
                                                     (slugify(v2.surnames[0]), id(v2))]))
        self.n = dict(x1=x1, x1w=x1w, kx=kx, x2=x2, y1=y1, y1w=y1w, y2=y2, ky=ky, wed2=wed2, k2=k2, x3=x3, v2=v2, v3=v3,
                      wed3=wed3, k3=k3, x4=x4, o4=o4, k4=k4, p4=p4, q4=q4, kq=kq, wed4=wed4, k5=k5, x5=x5)
        # The son who went to Cuba and came back
        x3.aliases = [f"{x3.given} el Indiano"]
        x3.story.append(f"Emigró a La Habana en {x3.year + 18} y volvió a Galicia hacia {x3.year + 24}, con ahorros "
                        f"para abrir una tienda en Lugo; en la familia le llamaban «el Indiano».")
        x3.occupation = "comerciante"
        o4.story.append("Murió joven, dejando dos hijos pequeños.")
        return x5

    def south(self):
        """The family of the south (Jaén and Granada): two branches joined by a marriage in Baeza, a soldier of the
        Rif war and a sister known only as such. Returns the heiress, born in the 1950s."""
        fam = "south"
        z1 = self.founder(1841, "Úbeda, Jaén", fam)
        z1w = self.outsider("F", 1845, "Úbeda, Jaén", fam)
        self.marry(z1, z1w, 1866, "Úbeda, Jaén")
        kz = self.children(z1, z1w, 1867, 4, "Úbeda, Jaén", 1, line=(1, "M"), conf="probable")
        z2 = kz[1]
        w1 = self.founder(1846, "Baeza, Jaén", fam)
        w1w = self.outsider("F", 1849, "Baeza, Jaén", fam)
        self.marry(w1, w1w, 1871, "Baeza, Jaén")
        kw = self.children(w1, w1w, 1872, 3, "Baeza, Jaén", 1, line=(0, "F"), conf="probable")
        w2 = kw[0]
        wed2 = self.marry(z2, w2, 1895, "Baeza, Jaén")
        k2 = self.children(z2, w2, 1896, 4, "Úbeda, Jaén", 1, line=(1, "M"))
        z3 = k2[1]
        z3w = self.outsider("F", z3.year + 3, "Cazorla, Jaén", fam)
        # Her sister: their parents are not known
        sis = self.person("F", self.date(z3w.year - 2), "Cazorla, Jaén", z3w.surnames, fam)
        sis.siblings, z3w.siblings = [z3w], [sis]
        wed3 = self.marry(z3, z3w, z3.year + 26, "Cazorla, Jaén")
        k3 = self.children(z3, z3w, year(wed3) + 1, 3, "Jaén", 0, line=(0, "M"))
        z4 = k3[0]
        z4w = self.outsider("F", z4.year + 3, "Guadix, Granada", fam)
        wed4 = self.marry(z4, z4w, z4.year + 27, "Granada")
        k4 = self.children(z4, z4w, year(wed4) + 2, 3, "Granada", 0, line=(1, "F"))
        z5 = k4[1]
        self.families.append((fam, z1.surnames[0], [(slugify(z1.surnames[0]), id(z1)),
                                                    (slugify(w1.surnames[0]), id(w1))]))
        self.n.update(z1=z1, z1w=z1w, kz=kz, z2=z2, w1=w1, w1w=w1w, w2=w2, kw=kw, wed2s=wed2, k2s=k2, z3=z3, z3w=z3w, sis=sis,
                      wed3s=wed3, k3s=k3, z4=z4, z4w=z4w, k4s=k4, z5=z5)
        z3.occupation = "guardia civil"
        z3.story.append(f"Hizo el servicio militar en Melilla en {z3.year + 21}, en los meses de la guerra del Rif, "
                        "y volvió sin heridas.")
        sis.occupation = "modista"
        sis.story.append(f"Hermana de {z3w.link}. Soltera, vivió con ella y la ayudó a criar a sus hijos.")
        return z5

    # --- sources ----------------------------------------------------------------

    def source(self, people, facts=(), **kw):
        s = Source(f"F{len(self.sources) + 1:03d}", **kw)
        self.sources.append(s)
        for p in people:
            if s.sid not in p.sources:
                p.sources.append(s.sid)
        for p, fact in facts:
            p.cites[fact] = s.sid
        return s

    def stranger(self):
        """Someone named in a document who is not in the tree."""
        return f"{self.fake.first_name_male()} {self.fake.last_name()} {self.fake.last_name()}"

    def cleric(self):
        return f"don {self.stranger()}"

    def cite_all(self):
        def wedding(a, b):
            return [(a, ("married", id(b))), (b, ("married", id(a)))]

        n = self.n
        north = [p for p in self.people if p.family == "north"]
        south = [p for p in self.people if p.family == "south"]
        x1, x1w, x2, y1, y1w, y2, x3, v2, v3, x4, o4, p4, q4, x5 = (n[k] for k in (
            "x1", "x1w", "x2", "y1", "y1w", "y2", "x3", "v2", "v3", "x4", "o4", "p4", "q4", "x5"))
        z1, z1w, z2, w1, w1w, w2, z3, z3w, sis, z4, z5 = (n[k] for k in (
            "z1", "z1w", "z2", "w1", "w1w", "w2", "z3", "z3w", "sis", "z4", "z5"))
        fam_north, fam_south = (f"{f[1]}" for f in self.families)

        # The family's own compilations: the family tree drawn by hand and the oral testimonies
        old = [p for p in north if p.year < 1940]
        tree_n = self.source(
            old, [(p, "born") for p in old], title=f"Árbol genealógico manuscrito de la familia {fam_north}",
            type="Árbol", category="arbol", date="c. 1950", place="Lugo",
            issuer=f"{x4.name}", origin="Cuaderno de la familia, dos hojas dibujadas a mano",
            intro=f"Árbol dibujado a lápiz por {x4.link} hacia 1950, a partir de lo que contaban sus padres y de los "
                  f"papeles de la casa. Recoge {len(old)} personas desde {x1.link}.",
            text="\n".join(f"- {p.name}" + (f", n. {p.year}" if p.year else "") + (f", † {year(p.died)}" if p.died
                           and year(p.died) < 1950 else "") for p in sorted(old, key=lambda p: p.year)),
            notes="Es un resumen hecho de memoria: las fechas de los más antiguos son aproximadas y la filiación de "
                  "los hijos de los fundadores solo consta aquí (por eso es «probable»).",
            files=[("arbol.png", lambda path: tree_sketch(path, x1, self.rng))])
        young_n = [p for p in north if p.year >= 1900]
        self.source(
            young_n, [(p, "born") for p in young_n if p.year >= 1940],
            title=f"Conversación con {x5.name} sobre su familia", type="Testimonio oral", category="genealogia",
            date="2021-03-14", place="Valencia", issuer=x5.name, origin="Notas de una llamada telefónica",
            intro=f"Lo que contó {x5.link} por teléfono sobre sus padres, sus hermanos y la familia de su padre.",
            text=f"> Mi padre, {x4.given}, se quedó viudo muy joven con dos críos, y a los pocos años se casó con mi "
                 f"madre, {p4.given}, que también era viuda y tenía un hijo. Nos criamos los cinco juntos en "
                 f"A Coruña, sin distinguir de quién era cada uno.\n>\n> Mi abuelo {x3.given} había estado en Cuba "
                 "de joven, y siempre decía que volvió por no aguantar el calor.",
            notes="Testimonio directo sobre su propia generación y la de sus padres.")
        old_s = [p for p in south if p.year < 1940]
        tree_s = self.source(
            old_s, [(p, "born") for p in old_s], title=f"Relación de la familia {fam_south} de Úbeda",
            type="Árbol", category="arbol", date="c. 1975", place="Granada", issuer=z4.name,
            origin="Tres hojas mecanografiadas", intro=f"Relación mecanografiada por {z4.link} hacia 1975, con "
            f"los nombres, fechas y lugares que conocía de sus abuelos y bisabuelos.",
            text="| Nombre | Nacimiento | Lugar |\n|---|---|---|\n" + "\n".join(
                f"| {p.name} | {p.born} | {town(p.birth_place)} |" for p in sorted(old_s, key=lambda p: p.year)),
            notes="Recopilada por la familia: un resumen, no una fuente de verdad. Donde un documento dice otra "
                  "cosa, gana el documento.")
        young_s = [p for p in south if p.year >= 1900]
        self.source(
            young_s, [(p, "born") for p in young_s if p.year >= 1940],
            title=f"Conversación con {z5.name} sobre sus abuelos", type="Testimonio oral", category="genealogia",
            date="2019-08-02", place="Valencia", issuer=z5.name, origin="Notas de una visita",
            intro=f"Lo que recuerda {z5.link} de sus abuelos de Jaén y de sus padres.",
            text=f"> El abuelo {z3.given} era guardia civil y había estado en Melilla en la guerra. La abuela "
                 f"{z3w.given} vivía con su hermana {sis.given}, que era modista y nunca se casó.",
            notes=f"No sabe los nombres de los padres de {z3w.given} y {sis.given}: se buscarán en el archivo "
                  "parroquial de Cazorla.")

        # Documents of the north
        priest = self.cleric()
        bapt = self.source(
            [x2, x1, x1w], [(x2, "born")], title=f"Partida de bautismo de {x2.name}", type="Partida de bautismo",
            category="genealogia", date=x2.born, place="Mondoñedo, Lugo",
            issuer="Parroquia de Santa María de Mondoñedo, libro 12 de bautismos, folio 43",
            origin="Copia sacada del archivo parroquial",
            intro=f"Bautismo de {x2.link}, hijo de {x1.link} y {x1w.link}: el único de los hijos de la pareja cuya "
                  "filiación prueba un documento.",
            text=f"> En la ciudad de Mondoñedo, a {spoken(x2.born)[3:]}, yo, {priest}, cura de esta parroquia de "
                 f"Santa María, bauticé solemnemente a un niño que nació ese mismo día, hijo legítimo de {x1.name} y "
                 f"de {x1w.name}, naturales y vecinos de esta ciudad. Se le puso por nombre {x2.given}. Fueron sus "
                 f"padrinos {self.stranger()} y su mujer, a quienes advertí el parentesco espiritual. Y lo firmo. "
                 f"— {priest[4:]}")
        bapt.files = [("partida.png", scan_writer("PARROQUIA DE SANTA MARÍA DE MONDOÑEDO", "Libro 12 de bautismos, "
                                                  "folio 43", bapt.text, self.rng))]
        x2.conf = "proven"
        wed = self.source(
            [x2, y2, y1, y1w], wedding(x2, y2), title=f"Partida de matrimonio de {x2.name} y "
            f"{y2.name}", type="Partida de matrimonio", category="genealogia", date=n["wed2"], place="Vilalba, Lugo",
            issuer="Parroquia de Santa María de Vilalba, libro 6 de matrimonios, folio 112",
            origin="Copia sacada del archivo parroquial",
            intro=f"Matrimonio de {x2.link} y {y2.link}, que une las ramas {x1.surnames[0]} y {y1.surnames[0]}.",
            text=f"> En Vilalba, a {spoken(n['wed2'])[3:]}, contrajeron matrimonio por palabras de presente "
                 f"{x2.name}, soltero, {x2.occupation}, natural de Mondoñedo, hijo de {x1.name} y de {x1w.name}, y "
                 f"{y2.name}, soltera, natural de esta villa, hija de {y1.name} y de {y1w.name}. Fueron testigos "
                 f"{self.stranger()} y {self.stranger()}.")
        wed.files = [("partida.png", scan_writer("PARROQUIA DE SANTA MARÍA DE VILALBA", "Libro 6 de matrimonios, "
                                                 "folio 112", wed.text, self.rng))]
        y2.conf = "proven"
        home = [x2, y2, *(k for k in n["k2"] if k.year <= 1900 and (not k.died or year(k.died) > 1900))]
        census_age = 1900 - x2.year + 2  # the padrón makes him two years older than his baptism
        census = self.source(
            home, [], title="Padrón municipal de Ribadeo, 1900", type="Padrón", category="genealogia",
            date="1900-12-31", place="Ribadeo, Lugo", issuer="Ayuntamiento de Ribadeo", status="documentado",
            origin="Hoja de la familia, fotografiada en el archivo municipal",
            intro=f"La hoja del padrón de 1900 con la casa de {x2.link} y {y2.link}.",
            text="| Nombre | Parentesco | Edad | Profesión |\n|---|---|---|---|\n" + "\n".join(
                f"| {p.name} | {rel} | {age} | {p.occupation or ''} |" for p, rel, age in
                [(x2, "cabeza de familia", census_age), (y2, "esposa", 1900 - y2.year)] +
                [(k, "hijo" if k.sex == "M" else "hija", 1900 - k.year) for k in home[2:]]),
            notes=f"Da a {x2.given} {census_age} años, dos más de los que tenía según su partida de bautismo.")
        census.files = [("hoja.png", scan_writer("PADRÓN MUNICIPAL DE RIBADEO · 1900", "Distrito 1.º, hoja 57",
                                                 census.text, self.rng))]
        self.research["incoherencias"].append((
            "north", slugify(x1.surnames[0]),
            f"**Año de nacimiento de {x2.link}**: su partida de bautismo {bapt.cite} dice {x2.year}; el padrón de "
            f"1900 {census.cite} le da {census_age} años (nacido hacia {1900 - census_age}). Se sigue la partida, "
            "más cercana al hecho."))
        sail = x3.year + 18
        ship = self.source(
            [x3], [], title=f"Pasaje de {x3.name} a La Habana", type="Registro de pasajeros", category="genealogia",
            date=f"{sail}-04-12", place="A Coruña", issuer="Registro de pasajeros del puerto de A Coruña",
            status="indicio", review="pendiente",
            origin="Hallado por investigación automática en un índice de pasajeros en línea",
            intro=f"Un pasajero con el nombre de {x3.link} y la edad que tendría, embarcado para Cuba.",
            text=f"> Vapor «Reina María Cristina», salido de A Coruña el 12 de abril de {sail} con destino a La "
                 f"Habana. Pasajero n.º 214: {x3.name}, {sail - x3.year} años, soltero, labrador, natural de "
                 "Ribadeo.",
            notes="Encaja con lo que cuenta la familia, pero no dice los padres: puede ser otra persona del mismo "
                  "nombre. Hasta que alguien de la familia lo revise, es un indicio.")
        x3.cites["story"] = ship.sid
        photo = self.source(
            [x3, v3, v2], [], title=f"Fotografía de la boda de {x3.name} y {v3.name}", type="Fotografía",
            category="foto", date=n["wed3"], place="Viveiro, Lugo", issuer="Estudio fotográfico de Viveiro",
            origin="Álbum de la familia",
            intro=f"Retrato de grupo el día de la boda de {x3.link} y {v3.link}.",
            text=f"Copia en papel, pegada sobre cartón. En el reverso, a lápiz: «Boda de {x3.given} y {v3.given}, "
                 f"Viveiro, {year(n['wed3'])}». Los novios en el centro; a la derecha de la novia, su padre, "
                 f"{v2.name}.",
            files=[("boda.jpg", lambda path: group_photo(path, 7, self.rng))])
        for p, fact in wedding(x3, v3):
            p.cites[fact] = photo.sid
        self.research["incoherencias"].append((
            "north", slugify(v2.surnames[0]),
            f"**Lugar de nacimiento de {v3.link}**: el árbol manuscrito {tree_n.cite} la hace nacer en Ribadeo; la "
            f"familia de su padre era de Viveiro, donde se casó {photo.cite}. Falta su partida de bautismo."))
        notary = self.stranger()
        will_date = self.date(min(year(x2.died) - 1, 1930))
        heirs = [k for k in n["k2"] if not k.died or year(k.died) > year(will_date)]
        will = self.source(
            [x2, *heirs], [], title=f"Testamento de {x2.name}", type="Testamento", category="patrimonio",
            date=will_date, place="Ribadeo, Lugo", issuer=f"Notario {notary}, Ribadeo",
            origin="Copia simple guardada en la casa",
            intro=f"Testamento abierto de {x2.link}, que nombra a sus hijos vivos.",
            text=f"> En la villa de Ribadeo, a {spoken(will_date)[3:]}, ante mí, {notary}, notario del Ilustre "
                 f"Colegio de A Coruña, comparece don {x2.name}, de estado casado con doña {y2.name}, y dice: que "
                 "instituye por únicos y universales herederos a sus hijos " + ", ".join(k.name for k in heirs) +
                 ", por partes iguales, y lega a su esposa el usufructo de la casa en que viven.")
        will.files = [("testamento.png", scan_writer("NOTARÍA DE RIBADEO", f"Protocolo de {year(will_date)}, "
                                                     "número 88", will.text, self.rng))]
        self.source(
            [o4, x4], [(o4, "died")], title=f"Inscripción de defunción de {o4.name}", type="Inscripción de defunción",
            category="genealogia", date=o4.died, place="Lugo", issuer="Registro Civil de Lugo, tomo 94, folio 17",
            origin="Certificado literal pedido al Registro Civil",
            intro=f"La muerte de {o4.link}, primera mujer de {x4.link}.",
            text=f"> En Lugo, a {spoken(o4.died)[3:]}, se inscribe la defunción de doña {o4.name}, de "
                 f"{year(o4.died) - o4.year} años, casada con don {x4.name}, que falleció en su domicilio a "
                 "consecuencia de una tuberculosis pulmonar. Deja dos hijos menores de edad.")
        self.source(
            [x4, p4, *n["k5"]], wedding(x4, p4), title=f"Libro de familia de {x4.name} y "
            f"{p4.name}", type="Libro de familia", category="genealogia", date=n["wed4"], place="A Coruña",
            issuer="Registro Civil de A Coruña", origin="Original en casa de la familia",
            intro=f"El segundo matrimonio de {x4.link}, viudo, con {p4.link}, viuda de {q4.link}, y los hijos de "
                  "ambos.",
            text=f"- Matrimonio: A Coruña, {spoken(n['wed4'])[3:]}. Él, viudo de {o4.name}; ella, viuda de "
                 f"{q4.name}.\n" + "\n".join(f"- Hijo {i}: {k.name}, nacido {spoken(k.born)}." for i, k in
                                              enumerate(n["k5"], 1)))
        obit_people = [x4, p4, *n["k4"], *n["kq"], *n["k5"]]
        obit = self.source(
            obit_people, [(x4, "died")], title=f"Esquela de {x4.name}", type="Esquela", category="contexto",
            date=x4.died, place="A Coruña", issuer="Prensa de A Coruña", status="indicio", review="pendiente",
            origin="Hallada por investigación automática en una hemeroteca digital",
            intro=f"La esquela de {x4.link}, con su familia.",
            text=f"> **{x4.name.upper()}** falleció en A Coruña {spoken(x4.died)}, a los {year(x4.died) - x4.year} "
                 f"años. D. E. P. Su esposa, {p4.name}; sus hijos, " + ", ".join(k.given for k in n["k4"] +
                                                                                n["kq"] + n["k5"]) +
                 ", y demás familia ruegan una oración por su alma.",
            notes="Confirma que la familia contaba como hijos de los dos a los tres de la casa.")
        self.research["pendientes"].append((
            "north", slugify(x1.surnames[0]),
            f"**Partidas de bautismo de los hermanos de {x2.link}**, en el archivo parroquial de Mondoñedo: hoy su "
            f"filiación solo consta en el árbol manuscrito {tree_n.cite}."))
        self.research["pendientes"].append((
            "north", slugify(x1.surnames[0]),
            f"**Revisar el pasaje de {x3.link} a La Habana** {ship.cite}: buscar en el mismo índice el viaje de "
            "vuelta."))
        self.research["pendientes"].append((
            "north", slugify(y1.surnames[0]),
            f"**Defunción de {y1.link}**, en Vilalba: la fecha del árbol {tree_n.cite} es de memoria."))
        self.research["pendientes"].append((
            "north", slugify(v2.surnames[0]),
            f"**Partida de bautismo de {v3.link}** (Viveiro o Ribadeo), para aclarar dónde nació."))

        # Documents of the south
        priest = self.cleric()
        bapt_s = self.source(
            [z2, z1, z1w], [(z2, "born")], title=f"Partida de bautismo de {z2.name}", type="Partida de bautismo",
            category="genealogia", date=z2.born, place="Úbeda, Jaén",
            issuer="Parroquia de San Pablo de Úbeda, libro 31 de bautismos, folio 208",
            origin="Copia sacada del archivo parroquial",
            intro=f"Bautismo de {z2.link}, hijo de {z1.link} y {z1w.link}.",
            text=f"> En la ciudad de Úbeda, a {spoken(z2.born)[3:]}, yo, {priest}, teniente cura de la parroquial "
                 f"de San Pablo, bauticé a un niño hijo de {z1.name}, {z1.occupation}, y de {z1w.name}, su legítima "
                 f"mujer, vecinos de esta ciudad; se le puso por nombre {z2.given}. — {priest[4:]}")
        bapt_s.files = [("partida.png", scan_writer("PARROQUIA DE SAN PABLO DE ÚBEDA", "Libro 31 de bautismos, "
                                                    "folio 208", bapt_s.text, self.rng))]
        z2.conf = "proven"
        self.source(
            [z2, w2, w1, w1w], wedding(z2, w2), title=f"Partida de matrimonio de {z2.name} y "
            f"{w2.name}", type="Partida de matrimonio", category="genealogia", date=n["wed2s"], place="Baeza, Jaén",
            issuer="Parroquia de Santa María de Baeza, libro 14 de matrimonios, folio 76",
            origin="Copia sacada del archivo parroquial",
            intro=f"Matrimonio de {z2.link} y {w2.link}.",
            text=f"> En Baeza, a {spoken(n['wed2s'])[3:]}, se desposaron {z2.name}, natural de Úbeda, hijo de "
                 f"{z1.name} y {z1w.name}, y {w2.name}, natural de esta ciudad, hija de {w1.name} y {w1w.name}.")
        w2.conf = "proven"
        self.source(
            [z2, w2, *(k for k in n["k2s"] if not k.infant)], [], title=f"Fotografía de la familia {z2.surnames[0]} "
            "en Úbeda", type="Fotografía", category="foto", date="c. 1912", place="Úbeda, Jaén",
            issuer="Fotógrafo ambulante", origin="Álbum de la familia",
            intro=f"{z2.link} y {w2.link} con sus hijos, delante de su casa.",
            text="Copia pequeña, muy clara, con el borde dentado. Sin nada escrito: los nombres los puso "
                 f"{z5.given} al verla.",
            files=[("familia.jpg", lambda path: group_photo(path, 2 + len(n["k2s"]), self.rng))])
        service = f"{z3.year + 20}-{self.rng.randint(1, 12):02d}-{self.rng.randint(1, 28):02d}"
        mil = self.source(
            [z3], [], title=f"Hoja de servicios de {z3.name}", type="Hoja de servicios", category="genealogia",
            date=service, place="Melilla", issuer="Archivo General Militar de Guadalajara", status="documentado",
            origin="Copia pedida al archivo",
            intro=f"El servicio militar de {z3.link} en Melilla.",
            text=f"> {z3.name}, hijo de {z2.given} y de {w2.given}, natural de Úbeda, de oficio "
                 f"{z3.occupation}. Ingresó en caja {spoken(service)}. Destinado al Regimiento de Infantería de "
                 f"Melilla; sirvió en campaña de julio de {z3.year + 21} a marzo de {z3.year + 22}.",
            notes=f"La hoja lo hace nacer en {z3.year - 1}; la relación de la familia {tree_s.cite}, en {z3.year}.")
        z3.cites["story"] = mil.sid
        mil.files = [("hoja.png", scan_writer("HOJA DE SERVICIOS", "Regimiento de Infantería de Melilla",
                                              mil.text, self.rng))]
        self.research["incoherencias"].append((
            "south", slugify(z1.surnames[0]),
            f"**Año de nacimiento de {z3.link}**: la hoja de servicios {mil.cite} dice {z3.year - 1}; la relación "
            f"de la familia {tree_s.cite}, {z3.year}. Hace falta su partida de bautismo."))
        self.research["pendientes"].append((
            "south", slugify(z1.surnames[0]),
            f"**Partida de bautismo de {z3.link}** en Úbeda, para fijar el año."))
        self.research["pendientes"].append((
            "south", slugify(w1.surnames[0]),
            f"**Padres de {w1.link}**: la relación {tree_s.cite} empieza en él. Buscar su bautismo en Baeza hacia "
            f"{w1.year}."))
        self.research["pendientes"].append((
            "south", None,
            f"**Padres de {z3w.link} y {sis.link}**: preguntar a {z5.link}, y buscar en el archivo parroquial de "
            "Cazorla."))
        self.research["pendientes"].append((
            None, None,
            f"**Revisar los documentos hallados por investigación automática**: {ship.cite} y {obit.cite}."))
        self.research["incoherencias"].append((
            None, None,
            f"**Fecha de la boda de {x5.link} y {z5.link}**: los dos la recuerdan en {year(x5.marriages[0][1])}, "
            "pero no hay documento: pedir su certificado de matrimonio."))

        for p in self.people:
            if not p.sources:
                p.sources.append(tree_n.sid if p.family == "north" else tree_s.sid)
            self.biography(p)

    def biography(self, p):
        def cite(fact):
            sid = p.cites.get(fact)
            return f" ([{sid}](../sources/{sid}.md))" if sid else ""

        parents = [x for x in (p.father, p.mother) if x]
        s = f"Nació en {town(p.birth_place)} {spoken(p.born)}{cite('born')}"
        if parents:
            s += ", " + ("hijo" if p.sex == "M" else "hija") + " de " + " y ".join(x.link for x in parents)
        text = [s + "."]
        if p.infant:
            text.append(f"Murió de niño {spoken(p.died)}{cite('died')}.")
            p.biography = " ".join(text)
            return
        if p.occupation:
            text.append(("Fue " if p.died else "Es ") + p.occupation + "." if p.occupation != "sus labores"
                        else "Se ocupó de su casa.")
        for other, when, place in p.marriages:
            text.append(f"Se casó en {town(place)} {spoken(when)}{cite(('married', id(other)))} con {other.link}.")
        kids = p.children
        if kids:
            text.append(f"Tuvo {len(kids)} {'hijo' if len(kids) == 1 else 'hijos'}: " +
                        ", ".join(k.link for k in sorted(kids, key=lambda k: k.born)) + ".")
        story = [x + (cite("story") if i == 0 else "") for i, x in enumerate(p.story)]
        text += story
        if p.died:
            text.append(f"Murió en {town(p.death_place)} {spoken(p.died)}{cite('died')}.")
        p.biography = " ".join(text)
        if p.conf == "probable" and parents:
            p.notes.append("La filiación solo consta en la recopilación de la familia: falta la partida de "
                           "bautismo que la pruebe.")

    # --- writing ------------------------------------------------------------------

    def write(self, out):
        people, sources, research = (out / PATHS[k] for k in ("people", "sources", "research"))
        for d in (people, sources, research):
            d.mkdir(parents=True)
        (out / MARKER).write_text("Written by scripts/demo.py: a new run replaces this folder.\n", encoding="utf-8")
        (out / "families.yml").write_text(self.config(), encoding="utf-8")
        (out / "places.yml").write_text(self.places(), encoding="utf-8")
        for p in self.people:
            (people / f"{p.slug}.md").write_text(self.person_note(p), encoding="utf-8")
        for s in self.sources:
            (sources / f"{s.sid}.md").write_text(self.source_note(s), encoding="utf-8")
            for name, draw in s.files:
                (sources / s.sid).mkdir(exist_ok=True)
                draw(sources / s.sid / name)
        for name, title, intro in (
                ("incoherencias", "Incoherencias", "Contradicciones entre documentos, y cuál se sigue."),
                ("pendientes", "Líneas de investigación pendientes", "Lo que falta por buscar o preguntar.")):
            (research / f"{name}.md").write_text(self.research_note(name, title, intro), encoding="utf-8")

    def config(self):
        branches = [(fam, key, f) for fam, _, bs in self.families for key, f in bs]
        by_id = {id(p): p for p in self.people}
        lines = ["# A fictional tree, written by scripts/demo.py", "language: es", "paths:"]
        lines += [f"  {k}: {v}" for k, v in PATHS.items()]
        lines += [f"main: {self.main.slug}", "families:"]
        for i, (key, surname, bs) in enumerate(self.families):
            joined = " y ".join(by_id[f].surnames[0] for _, f in bs[:2])
            lines += [f"  - key: {key}", f"    label: {q(f'Familia {surname}')}",
                      f"    title: {q(f'Familia {surname} ({joined})')}", f"    of: {q(f'de la familia {surname}')}"]
            lines += ["    default: true"] if i == 0 else []
        lines.append("branches:")
        for i, (fam, key, f) in enumerate(branches):
            label = by_id[f].surnames[0]
            lines.append(f'  - {{key: {key}, label: {q(label)}, color: "{BRANCH_COLORS[i]}", founder: {by_id[f].slug}, '
                         f"family: {fam}}}")
        o = OTHER_BRANCH
        lines.append(f'other_branch: {{key: {o["key"]}, label: {o["label"]}, color: "{o["color"]}"}}')
        lines.append("groups:")
        for key, _, bs in self.families:
            labels = [by_id[f].surnames[0] for _, f in bs]
            title = ", ".join(labels[:-1]) + " y " + labels[-1]
            lines.append(f"  - {{family: {key}, title: {q(title)}, branches: [{', '.join(k for k, _ in bs)}]}}")
        return "\n".join(lines) + "\n"

    def places(self):
        used = {x for p in self.people for x in (p.birth_place, p.death_place) if x}
        used |= {w[2] for p in self.people for w in p.marriages} | {s.place for s in self.sources}
        lines = ["# Coordinates of the places of the fictional tree (scripts/demo.py)"]
        for place in sorted(used):
            lat, lon, name = PLACES[place]
            lines.append(f"{q(place)}: {{lat: {lat}, lon: {lon}, name: {q(name)}}}")
        return "\n".join(lines) + "\n"

    def person_note(self, p):
        fm = [f"given_name: {q(p.given)}", f"surnames: {q(' '.join(p.surnames))}"]
        if p.aliases:
            fm.append("aliases: [" + ", ".join(q(a) for a in p.aliases) + "]")
        fm += [f"sex: {p.sex}", f"born: {ydate(p.born)}", f"birth_place: {q(p.birth_place)}"]
        if p.died:
            fm += [f"died: {ydate(p.died)}", f"death_place: {q(p.death_place)}"]
        if p.occupation:
            fm.append(f"occupation: {q(p.occupation)}")
        if p.birth_order:
            fm.append(f"birth_order: {p.birth_order}")
        if p.father:
            fm += [f'father: "[[{p.father.slug}]]"', f'mother: "[[{p.mother.slug}]]"', f"parents_confidence: {p.conf}"]
        if p.siblings:
            fm.append("siblings: [" + ", ".join(f'"[[{x.slug}]]"' for x in p.siblings) + "]")
        if p.spouses:
            fm.append("spouses: [" + ", ".join(f'"[[{x.slug}]]"' for x in p.spouses) + "]")
            fm.append("marriages:")
            fm += [f"  - {{spouse: {x.slug}, date: {when}, place: {q(place)}}}" for x, when, place in p.marriages]
        if p.living:
            fm.append("living: true")
        elif p.died:
            fm.append("living: false")
        if p.tags:
            fm.append("tags: [" + ", ".join(f"rama/{t}" for t in sorted(p.tags)) + "]")
        fm.append("sources: [" + ", ".join(f'"[[{s}]]"' for s in p.sources) + "]")
        notes = "\n\n".join(p.notes)
        return ("---\n" + "\n".join(fm) + f"\n---\n# {p.name}\n\n## Biografía\n\n{fill(p.biography)}\n\n"
                f"## Notas de investigación\n\n{fill(notes) + chr(10) if notes else ''}")

    def source_note(self, s):
        fm = [f"id: {s.sid}", f"title: {q(s.title)}", f"type: {q(s.type)}", f"category: {s.category}",
              f"date: {ydate(s.date)}", f"place: {q(s.place)}", f"issuer: {q(s.issuer)}", f"status: {s.status}",
              f"origin: {q(s.origin)}"]
        if s.review:
            fm.append(f"review: {s.review}")
        if s.files:
            fm.append("files:")
            fm += [f"  - {q(f'{s.sid}/{name}')}" for name, _ in s.files]
        body = f"# {s.sid} — {s.title}\n\n{fill(s.intro)}\n\n## Transcripción y descripción\n\n{s.text}\n"
        if s.notes:
            body += f"\n## Notas de investigación\n\n{fill(s.notes)}\n"
        return "---\n" + "\n".join(fm) + "\n---\n" + body

    def research_note(self, name, title, intro):
        items = self.research[name]
        by_id = {id(p): p for p in self.people}
        out = [f"# {title}", "", intro, ""]
        for key, surname, bs in self.families:
            joined = " y ".join(by_id[f].surnames[0] for _, f in bs[:2])
            out += [f"## Familia {surname} ({joined})", ""]
            for bkey, f in [*bs, (None, None)]:
                mine = [t for fam, b, t in items if fam == key and b == bkey]
                if not mine:
                    continue
                out += [f"### {by_id[f].surnames[0] if f else 'Varias ramas'}", ""]
                out += [fill(f"- [ ] {t}", indent="  ") for t in mine] + [""]
        out += ["## General", ""]
        out += [fill(f"- [ ] {t}", indent="  ") for fam, _, t in items if fam is None] + [""]
        return "\n".join(out)


def fill(text, indent=""):
    """Wraps a paragraph at 120 columns, as the notes of the repository."""
    return "\n".join(textwrap.wrap(text, 120, subsequent_indent=indent, break_long_words=False,
                                   break_on_hyphens=False)) if text else ""


# --- images: stand-ins for the scans and photos of the originals ---------------------------------------------------

INK = (58, 42, 28)
PAPER = (238, 228, 204)
# Pillow's own font (the same on every machine) has no accented letters: they are drawn as the plain letter and its
# mark; other signs, replaced
SIGNS = {"—": "-", "«": '"', "»": '"', "º": "o", "ª": "a", "¿": "", "¡": "", "·": "."}


def letters(text):
    """[(plain letter, mark or '')] of a text: «ñ» is ('n', '\u0303')."""
    out = []
    for ch in unicodedata.normalize("NFD", "".join(SIGNS.get(c, c) for c in text)):
        if unicodedata.combining(ch) and out:
            out[-1] = (out[-1][0], ch)
        elif ch.isascii():
            out.append((ch, ""))
    return out


def text_width(text, font):
    return font.getlength("".join(c for c, _ in letters(text)))


def write_text(d, xy, text, font, fill):
    """Draws a line of text from its top-left corner, with the accents as strokes."""
    x, y = xy
    size = font.size
    for ch, mark in letters(text):
        d.text((x, y), ch, font=font, fill=fill)
        w = font.getlength(ch)
        if mark:
            top = y + font.getbbox(ch)[1] - size * .12
            cx, width = x + w / 2, max(1, round(size / 14))
            if mark == "\u0301":  # acute
                d.line([cx - size * .08, top, cx + size * .1, top - size * .16], fill=fill, width=width)
            elif mark == "\u0303":  # tilde
                pts = [(cx - size * .2 + i * size * .04, top - size * .06 - size * .05 * math.sin(i / 10 * 2 * math.pi))
                       for i in range(11)]
                d.line(pts, fill=fill, width=width)
            elif mark == "\u0308":  # diaeresis
                for dx in (-size * .12, size * .12):
                    d.ellipse([cx + dx - width, top - size * .06 - width, cx + dx + width, top - size * .06 + width],
                              fill=fill)
        x += w


def scan_writer(heading, subheading, text, rng):
    """A function that draws a fake scan of a document: its heading and its transcription on old paper."""
    seed = rng.random()
    return lambda path: scan(path, heading, subheading, text, random.Random(seed))


def scan(path, heading, subheading, text, rng):
    w, h = 900, 1000
    img = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(img)
    for _ in range(6):  # stains
        x, y, r = rng.randint(0, w), rng.randint(0, h), rng.randint(40, 160)
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(c - rng.randint(4, 12) for c in PAPER))
    img = img.filter(ImageFilter.GaussianBlur(30))
    d = ImageDraw.Draw(img)
    d.rectangle([36, 36, w - 36, h - 36], outline=(160, 130, 90), width=3)
    big, small = ImageFont.load_default(size=30), ImageFont.load_default(size=26)
    write_text(d, ((w - text_width(heading, big)) / 2, 84), heading, big, INK)
    write_text(d, ((w - text_width(subheading, small)) / 2, 134), subheading, small, INK)
    d.line([120, 180, w - 120, 180], fill=INK, width=2)
    plain = re.sub(r"[>*|]|-{3,}", " ", text).replace("\n", " ")
    y = 230
    for line in textwrap.wrap(re.sub(r"\s+", " ", plain).strip(), 54):
        if y > h - 200:
            break
        write_text(d, (90 + rng.randint(-2, 2), y), line, small, INK)
        y += 42
    cx, cy = w - 190, h - 150  # seal
    d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], outline=(120, 60, 60), width=4)
    d.ellipse([cx - 55, cy - 55, cx + 55, cy + 55], outline=(120, 60, 60), width=2)
    img.save(path, optimize=True)


def group_photo(path, n, rng):
    """A fake old photo: n silhouettes on a sepia background with a white border."""
    w, h, border = 1000, 700, 36
    img = Image.new("RGB", (w, h), (112, 90, 64))
    d = ImageDraw.Draw(img)
    for y in range(h):  # light from above
        t = y / h
        d.line([0, y, w, y], fill=(int(196 - 90 * t), int(170 - 80 * t), int(130 - 66 * t)))
    d.rectangle([0, int(h * .72), w, h], fill=(96, 76, 54))
    step = (w - 2 * border - 120) / max(n - 1, 1)
    for i in range(n):
        x = border + 60 + i * step + rng.randint(-10, 10)
        tall = rng.uniform(.75, 1) if i % 3 else rng.uniform(.55, .75)
        top = h * (.72 - .5 * tall)
        tone = rng.randint(40, 70)
        body = (tone, int(tone * .8), int(tone * .6))
        d.rounded_rectangle([x - 52, top + 62, x + 52, h * .9], radius=40, fill=body)
        d.ellipse([x - 30, top, x + 30, top + 72], fill=(150, 120, 90))
    img = img.filter(ImageFilter.GaussianBlur(2.5))
    framed = Image.new("RGB", (w, h), (244, 238, 224))
    framed.paste(img.crop((border, border, w - border, h - border)), (border, border))
    framed.save(path, quality=82)


def tree_sketch(path, root, rng):
    """A fake hand-drawn tree: boxes joined by lines, in pencil, on a notebook page."""
    w, h = 1100, 800
    img = Image.new("RGB", (w, h), (246, 242, 230))
    d = ImageDraw.Draw(img)
    for y in range(60, h, 32):
        d.line([0, y, w, y], fill=(200, 212, 226))
    font = ImageFont.load_default(size=20)
    pencil = (80, 80, 88)
    rows = [[root]]
    while len(rows) < 4:
        rows.append([c for p in rows[-1] for c in p.children][:6])
    pos = {}
    for r, row in enumerate(rows):
        for i, p in enumerate(row):
            x = (i + 1) * w / (len(row) + 1)
            y = 90 + r * 190
            pos[id(p)] = (x, y)
            if p.father and id(p.father) in pos:
                px, py = pos[id(p.father)]
                d.line([px, py + 24, x, y - 24], fill=pencil, width=2)
            d.rectangle([x - 85, y - 24, x + 85, y + 24], outline=pencil, width=2)
            name = p.given.split()[0]
            write_text(d, (x - text_width(name, font) / 2, y - 12), name, font, pencil)
    img = img.rotate(rng.uniform(-1.2, 1.2), fillcolor=(246, 242, 230))
    img.save(path, optimize=True)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("folder", nargs="?", default=str(DEFAULT_OUT), help="where to write the tree")
    out = Path(ap.parse_args(argv).folder).resolve()
    if out.exists() and any(out.iterdir()):
        if not (out / MARKER).is_file():
            sys.exit(f"{out} is not empty and was not written by this script: choose another folder")
        shutil.rmtree(out)
    demo = Demo().build()
    demo.write(out)
    living = sum(1 for p in demo.people if not p.died)
    print(f"{out}: {len(demo.people)} people ({living} without a death), {len(demo.sources)} sources")


if __name__ == "__main__":
    main(sys.argv[1:])
