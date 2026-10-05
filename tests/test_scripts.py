#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""The scripts on a fictional tree, in a temporary folder, whose data folders do not have the names of this
repository (the defaults: people, sources, research, portraits). Checks that validate, references and build_site work
and that the links they generate point to the configured folders; that families.yml rejects a language or a folder it
does not know; and that the public version of the site (and the public GEDCOM) has nothing of the living, and the leak
check finds it when it does. And that the demo tree (scripts/demo.py) is always the same, validates and is built.

Each script runs as `make` runs it (`uv run scripts/<script>.py`), with ARBRE_ROOT pointing to the fictional tree.
build_site needs the compiled interface (`make web`; `make test` builds it first).

Usage: uv run tests/test_scripts.py
"""

import base64
import datetime as dt
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

CODE = Path(__file__).resolve().parent.parent
PATHS = {"people": "people", "sources": "sources", "research": "research", "portraits": "portraits"}
# 1x1 PNG, for a source's original and a portrait
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

CONFIG = """\
language: {language}
paths:
  people: {people}
  sources: {sources}
  research: {research}
  portraits: {portraits}
main: {main}
families:
  - {{key: ferrer, label: Ferrer family, title: Ferrer family, of: of the Ferrer family, default: true}}
branches:
  - {{key: ferrer, label: Ferrer, color: "#2a78d6", founder: jaume-ferrer-soler, family: ferrer}}
  - {{key: puig, label: Puig, color: "#eb6834", founder: rosa-puig-vidal, family: ferrer}}
other_branch: {{key: others, label: Other families, color: "#9a958c"}}
groups:
  - {{family: ferrer, title: Ferrer and Puig, branches: [ferrer, puig]}}
"""


def person(given, surnames, sex, born, sources, living="false", body="Fictional person.", **links):
    extra = "".join(f'{k}: "[[{v}]]"\n' for k, v in links.items() if k in ("father", "mother"))
    if "father" in links or "mother" in links:
        extra += "parents_confidence: proven\n"
    if "spouse" in links:
        extra += f'spouses: ["[[{links["spouse"]}]]"]\n'
    if "photo" in links:
        extra += f"photo: {links['photo']}\n"
    if "died" in links:
        extra += f"died: {links['died']}\n"
    refs = ", ".join(f'"[[{s}]]"' for s in sources)
    living = f"living: {living}\n" if living else ""
    return (f"---\ngiven_name: {given}\nsurnames: {surnames}\nsex: {sex}\nborn: {born}\n{extra}"
            f"{living}tags: [rama/{surnames.split()[0].lower()}]\nsources: [{refs}]\n---\n"
            f"# {given} {surnames}\n\n## Biografía\n\n{body}\n\n## Notas de investigación\n\nAsk the family.\n")


def source(sid, title, files=(), review=None, date=1920):
    lines = [f"id: {sid}", f"title: {title}", "type: Acta", "category: genealogia", f"date: {date}",
             "origin: Fictional family archive"]
    if files:
        lines.append("files: [" + ", ".join(files) + "]")
    if review:
        lines.append(f"review: {review}")
    return "---\n" + "\n".join(lines) + f"\n---\n# {title}\n\nFictional document.\n"


def make_tree(root, language="es", main="pau-ferrer-puig", living=False, extra_config="", **paths):
    """The fictional tree; with `living`, two more generations: Pau's daughter Anna (`living: true`) and her son Marc
    (born in 1990, without a death: living by the 100-year rule), and a recent document that cites Anna."""
    folders = {**PATHS, **paths}
    (root / "families.yml").write_text(CONFIG.format(language=language, main=main, **folders) + extra_config,
                                       encoding="utf-8")
    people, sources, research, portraits = (root / folders[k] for k in PATHS)
    for d in (people, sources / "F001", research, portraits):
        d.mkdir(parents=True, exist_ok=True)
    (sources / "F001" / "acta.png").write_bytes(PNG)
    (portraits / "pau-ferrer-puig.png").write_bytes(PNG)
    notes = {
        people / "jaume-ferrer-soler.md": person("Jaume", "Ferrer Soler", "M", 1890, ["F001"], spouse="rosa-puig-vidal"),
        people / "rosa-puig-vidal.md": person("Rosa", "Puig Vidal", "F", 1892, ["F001"], spouse="jaume-ferrer-soler"),
        people / "pau-ferrer-puig.md": person("Pau", "Ferrer Puig", "M", 1921, ["F001", "F002"],
                                              father="jaume-ferrer-soler", mother="rosa-puig-vidal",
                                              photo=f"{folders['portraits']}/pau-ferrer-puig.png"),
        sources / "F001.md": source("F001", "Marriage record", ["F001/acta.png"]),
        # Found by automated research: it goes to revision.md
        sources / "F002.md": source("F002", "Newspaper notice", review="pendiente"),
        research / "incoherencias.md": "# Incoherencias\n\n## Ferrer family\n\n- Fictional item "
                                       f"([F001](../{folders['sources']}/F001.md)).\n",
        research / "pendientes.md": "# Pendientes\n\n## Ferrer family\n\n- Nothing yet.\n",
    }
    if living:
        notes.update({
            # Jaume and Rosa died; his biography links Anna and hers names Marc
            people / "jaume-ferrer-soler.md": person(
                "Jaume", "Ferrer Soler", "M", 1890, ["F001"], spouse="rosa-puig-vidal", died=1960,
                body=f"His granddaughter [Anna](../{folders['people']}/anna-ferrer-roca.md) keeps his watch."),
            people / "rosa-puig-vidal.md": person(
                "Rosa", "Puig Vidal", "F", 1892, ["F001"], spouse="jaume-ferrer-soler", died=1970,
                body="She met her great-grandson Marc Ferrer Roca in 1968."),
            people / "pau-ferrer-puig.md": person(
                "Pau", "Ferrer Puig", "M", 1921, ["F001", "F002"], father="jaume-ferrer-soler",
                mother="rosa-puig-vidal", died=2001, photo=f"{folders['portraits']}/pau-ferrer-puig.png"),
            people / "anna-ferrer-roca.md": person(
                "Anna", "Ferrer Roca", "F", "1961-05-17", ["F003"], living="true", father="pau-ferrer-puig",
                body="Architect in Tarragona."),
            people / "marc-ferrer-roca.md": person(
                "Marc", "Ferrer Roca", "M", "1990-02-03", [], living=None, mother="anna-ferrer-roca"),
            sources / "F003.md": source("F003", "Graduation of Anna Ferrer Roca", ["F003/titol.png"], date=1985),
        })
        (sources / "F003").mkdir()
        (sources / "F003" / "titol.png").write_bytes(PNG)
    for path, text in notes.items():
        path.write_text(text, encoding="utf-8")
    return folders


def run(root, script, *args):
    env = {**os.environ, "ARBRE_ROOT": str(root)}
    return subprocess.run(["uv", "run", "--quiet", str(CODE / "scripts" / f"{script}.py"), *args],
                          cwd=root, env=env, capture_output=True, text=True)


def read_data(page):
    html = page.read_text(encoding="utf-8")
    start = html.index("const DATA = ") + len("const DATA = ")
    return json.loads(html[start:html.index(";</script>", start)]), html


class ConfiguredFolders(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        cls.paths = make_tree(cls.root)
        cls.refs = run(cls.root, "references")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def read(self, role, name):
        return (self.root / self.paths[role] / name).read_text(encoding="utf-8")

    def test_references_link_to_the_configured_folders(self):
        self.assertEqual(self.refs.returncode, 0, self.refs.stderr)
        self.assertIn("- [F001 — Marriage record](../sources/F001.md)", self.read("people", "pau-ferrer-puig.md"))
        self.assertIn("- [Pau Ferrer Puig](../people/pau-ferrer-puig.md)", self.read("sources", "F001.md"))

    def test_revision_links_to_the_configured_folders(self):
        revision = self.read("research", "revision.md")
        self.assertIn("[abrir F002](../sources/F002.md)", revision)
        self.assertIn("[Pau Ferrer Puig](../people/pau-ferrer-puig.md)", revision)

    def test_validate(self):
        result = run(self.root, "validate")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("0 errors", result.stdout)
        self.assertNotIn("broken link", result.stdout)

    def test_build_site(self):
        if not (CODE / "web" / "dist" / "web.js").is_file():
            self.skipTest("the interface is not compiled: run `make web`")
        out = self.root / "build" / "web"
        result = run(self.root, "build_site", "-o", str(out))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data, html = read_data(out / "index.html")
        self.assertIn('<html lang="es">', html)
        doc = next(d for d in data["docs"] if d["id"] == "F001")
        self.assertEqual(doc["files"][0]["url"], "../../sources/F001/acta.png")
        pau = next(p for p in data["people"] if p["id"] == "pau-ferrer-puig")
        self.assertEqual(pau["photo"], "media/portraits/pau-ferrer-puig.jpg")
        self.assertTrue((out / pau["photo"]).is_file())
        self.assertIn('data-doc="F001"', data["research"]["incoherencias"])
        # Not a Git repository: no history, and no error
        self.assertEqual(data["history"], [])

    def test_validate_requires_an_origin(self):
        note = self.root / "sources" / "F001.md"
        original = note.read_text(encoding="utf-8")
        try:
            note.write_text(original.replace("origin: Fictional family archive\n", ""), encoding="utf-8")
            result = run(self.root, "validate")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("no origin", result.stdout)
        finally:
            note.write_text(original, encoding="utf-8")

    def test_config_prints_the_folders(self):
        result = run(self.root, "config", "paths.sources")
        self.assertEqual((result.returncode, result.stdout), (0, "sources\n"), result.stderr)


class PublicSite(unittest.TestCase):
    """The site's pair (build/public and build/private) of a tree whose main person is living."""

    LIVING = ["anna", "ferrer roca", "anna-ferrer-roca", "marc-ferrer-roca", "1961-05-17", "1990-02-03", "tarragona",
              "graduation", "titol", "ask the family"]

    @classmethod
    def setUpClass(cls):
        if not (CODE / "web" / "dist" / "web.js").is_file():
            raise unittest.SkipTest("the interface is not compiled: run `make web`")
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        make_tree(cls.root, main="anna-ferrer-roca", living=True)
        run(cls.root, "references")
        cls.build = run(cls.root, "build_site")
        cls.public, cls.private = cls.root / "build" / "public", cls.root / "build" / "private"

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def public_text(self):
        """Every file of the public version, names included, in lowercase."""
        files = sorted(self.public.rglob("*"))
        return "\n".join([str(f.relative_to(self.public)) for f in files]
                         + [f.read_text(encoding="utf-8", errors="replace") for f in files if f.suffix == ".html"]).lower()

    def test_built_and_checked(self):
        self.assertEqual(self.build.returncode, 0, self.build.stdout + self.build.stderr)
        self.assertIn("leak check: 0 leaks", self.build.stdout)
        self.assertIn("2 living", self.build.stdout)

    def test_the_living_are_placeholders(self):
        data, _ = read_data(self.public / "index.html")
        self.assertEqual(data["access"], "public")
        living = [p for p in data["people"] if p["living"]]
        self.assertEqual(sorted(p["id"] for p in living), ["living-1", "living-2"])
        for p in living:
            self.assertEqual((p["name"], p["born"], p["photo"], p["sources"], p["html"], p["sex"]),
                             ("Persona viva", "", None, [], "", "U"))
        anna = next(p for p in living if p["father"] == "pau-ferrer-puig")
        marc = next(p for p in living if p["mother"] == anna["id"])
        self.assertEqual(next(p for p in data["people"] if p["id"] == "pau-ferrer-puig")["children"], [anna["id"]])
        self.assertEqual(anna["children"], [marc["id"]])
        # The main person is living: the web opens through the eyes of their father
        self.assertEqual(data["main"], "pau-ferrer-puig")
        self.assertEqual((data["research"], data["publicIds"]), ({}, {}))
        for word in self.LIVING:
            self.assertNotIn(word, self.public_text())

    def test_biographies_of_the_deceased(self):
        data, _ = read_data(self.public / "index.html")
        people = {p["id"]: p for p in data["people"]}
        # The link to Anna becomes «persona viva»; Rosa's names Marc, so it is hidden whole; no research notes
        self.assertIn("His granddaughter persona viva keeps his watch.", people["jaume-ferrer-soler"]["html"])
        self.assertEqual(people["rosa-puig-vidal"]["html"], "")
        self.assertNotIn("Notas de investigación", people["pau-ferrer-puig"]["html"])

    def test_documents(self):
        data, _ = read_data(self.public / "index.html")
        docs = {d["id"]: d for d in data["docs"]}
        # F001 and F002 (1920) are public, only their note and thumbnail; F003 cites Anna (and is from 1985)
        self.assertEqual(sorted(docs), ["F001", "F002"])
        self.assertEqual(docs["F001"]["files"], [])
        self.assertRegex(docs["F001"]["thumb"], r"^media/[0-9a-f]{20}\.jpg$")
        self.assertTrue((self.public / docs["F001"]["thumb"]).is_file())
        self.assertNotIn("acta.png", self.public_text())
        self.assertEqual(len(list((self.public / "media").iterdir())), 2)  # the thumbnail and Pau's portrait

    def test_private_data(self):
        data = json.loads((self.private / "data.json").read_text(encoding="utf-8"))
        self.assertEqual(data["access"], "private")
        self.assertEqual(data["main"], "anna-ferrer-roca")
        self.assertEqual(sorted(data["publicIds"].values()), ["anna-ferrer-roca", "marc-ferrer-roca"])
        f003 = next(d for d in data["docs"] if d["id"] == "F003")
        self.assertEqual(f003["files"][0]["url"], "sources/F003/titol.png")
        self.assertTrue(f003["thumb"].startswith("private/media/"))
        self.assertTrue((self.private / f003["thumb"].removeprefix("private/")).is_file())
        self.assertIn("incoherencias", data["research"])

    def test_public_gedcom(self):
        ged = self.root / "build" / "public.ged"
        result = run(self.root, "export_gedcom", "--public", "-o", str(ged))
        self.assertEqual(result.returncode, 0, result.stderr)
        text = ged.read_text(encoding="utf-8").lower()
        for word in self.LIVING:
            self.assertNotIn(word, text)
        self.assertEqual(text.count("1 name persona viva"), 2)
        check = run(self.root, "leak_check", str(ged))
        self.assertEqual(check.returncode, 0, check.stdout + check.stderr)

    def test_the_leak_check_finds_a_leak(self):
        leak = self.root / "build" / "leak"
        leak.mkdir(exist_ok=True)
        (leak / "page.html").write_text("<p>Marc Ferrer Roca, born on 3 de febrero de 1990</p>", encoding="utf-8")
        (leak / "anna-ferrer-roca.jpg").write_bytes(PNG)
        # In the JSON of a page, a line break is «\\n»: it must not glue itself to the next word
        (leak / "map.html").write_text('<script>const DATA = {"places": {"Nowhere": {"lat": 1, "lon": 2, "name": "x"}}, '
                                       '"html": "x\\nMarc Ferrer Roca, <p>Anna <em>Ferrer</em> Roca</p>"};</script>',
                                       encoding="utf-8")
        result = run(self.root, "leak_check", str(leak))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("«marc ferrer roca» — name of living-", result.stderr)
        self.assertIn("«3 de febrero de 1990» — date (born) of living-", result.stderr)
        self.assertIn("anna-ferrer-roca.jpg (name): «anna ferrer roca»", result.stderr)
        self.assertIn("map.html (DATA.places): «Nowhere» — a place of no public fact", result.stderr)
        self.assertIn("map.html (text): «marc ferrer roca»", result.stderr)
        self.assertIn("map.html (text without tags): «anna ferrer roca»", result.stderr)

    def test_a_living_date_hides_a_biography(self):
        note = self.root / "people" / "pau-ferrer-puig.md"
        original = note.read_text(encoding="utf-8")
        try:
            note.write_text(original.replace("Fictional person.", "A daughter born on 1961-05-17."), encoding="utf-8")
            result = run(self.root, "build_site", "--only", "site")
            data, _ = read_data(self.public / "index.html")
        finally:
            note.write_text(original, encoding="utf-8")
            run(self.root, "build_site", "--only", "site")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(next(p for p in data["people"] if p["id"] == "pau-ferrer-puig")["html"], "")

    def test_a_place_of_the_living_hides_a_biography(self):
        # A place only a living person has (Anna's birthplace) in a deceased's biography
        anna, pau = (self.root / "people" / f"{s}.md" for s in ("anna-ferrer-roca", "pau-ferrer-puig"))
        originals = {f: f.read_text(encoding="utf-8") for f in (anna, pau)}
        try:
            anna.write_text(originals[anna].replace("sex: F\n", "sex: F\nbirth_place: Vilafranca\n"), encoding="utf-8")
            pau.write_text(originals[pau].replace("Fictional person.", "He retired to Vilafranca."), encoding="utf-8")
            result = run(self.root, "build_site", "--only", "site")
            data, _ = read_data(self.public / "index.html")
        finally:
            for f, text in originals.items():
                f.write_text(text, encoding="utf-8")
            run(self.root, "build_site", "--only", "site")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(next(p for p in data["people"] if p["id"] == "pau-ferrer-puig")["html"], "")

    def test_a_leak_stops_the_build(self):
        # Anna's occupation in the text of a public document: privacy.py does not look for occupations, the leak check
        # does, and the public version is not replaced
        anna, f001 = self.root / "people" / "anna-ferrer-roca.md", self.root / "sources" / "F001.md"
        originals = {f: f.read_text(encoding="utf-8") for f in (anna, f001)}
        before = (self.public / "index.html").read_text(encoding="utf-8")
        try:
            anna.write_text(originals[anna].replace("sex: F\n", "sex: F\noccupation: Farera\n"), encoding="utf-8")
            f001.write_text(originals[f001].replace("Fictional document.", "Fictional document.\nFarera."),
                            encoding="utf-8")
            result = run(self.root, "build_site", "--only", "site")
        finally:
            for f, text in originals.items():
                f.write_text(text, encoding="utf-8")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("«farera» — occupation of living-", result.stderr)
        self.assertEqual((self.public / "index.html").read_text(encoding="utf-8"), before)


PLACES = """\
"Puerto Bajo": {lat: 43.5, lon: -5.7, name: Puerto Bajo}
"Monte Medio": {lat: 42.5, lon: -4.5}
"Río Hondo": {lat: 41.0, lon: -4.0, name: Río Hondo}
"Villa Alta (Comarca)": {}
"Por carta": {skip: true}
"""


class Places(unittest.TestCase):
    """places.yml: the warnings of validate, the places that go to the web and those that do not go to the public
    one (the living person's). Without network: geocode only lists what it would look up."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        paths = make_tree(cls.root)
        people, sources = cls.root / paths["people"], cls.root / paths["sources"]

        def add(path, after, lines):
            text = path.read_text(encoding="utf-8")
            path.write_text(text.replace(after, after + lines, 1), encoding="utf-8")

        add(people / "jaume-ferrer-soler.md", "sex: M\n", "birth_place: Puerto Bajo\ndeath_place: Villa Alta (Comarca)\n")
        add(people / "rosa-puig-vidal.md", "sex: F\n", "birth_place: Lugar Nuevo\ndeath_place: Por carta\n")
        # Pau is alive: his birthplace and the place of the document that names only him are his facts
        add(people / "pau-ferrer-puig.md", "sex: M\n", "birth_place: Monte Medio\n")
        path = people / "pau-ferrer-puig.md"
        path.write_text(path.read_text(encoding="utf-8").replace("living: false", "living: true"), encoding="utf-8")
        add(sources / "F002.md", "date: 1920\n", "place: Río Hondo\n")
        (cls.root / "places.yml").write_text(PLACES, encoding="utf-8")
        run(cls.root, "references")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_validate_warns_about_places_without_coordinates(self):
        result = run(self.root, "validate")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("«Lugar Nuevo» has no entry", result.stdout)
        self.assertIn("«Villa Alta (Comarca)» was not found", result.stdout)
        self.assertNotIn("Por carta", result.stdout)

    def test_geocode_looks_up_only_the_missing_places(self):
        result = run(self.root, "geocode", "--dry-run")
        self.assertEqual((result.returncode, result.stdout), (0, "Lugar Nuevo\n"), result.stderr)

    def test_build_site_sends_the_located_places(self):
        if not (CODE / "web" / "dist" / "web.js").is_file():
            self.skipTest("the interface is not compiled: run `make web`")
        result = run(self.root, "build_site")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        build = self.root / "build"
        for out, expected in (("web", ["Monte Medio", "Puerto Bajo", "Río Hondo"]), ("public", ["Puerto Bajo"])):
            data, html = read_data(build / out / "index.html")
            self.assertEqual(sorted(data["places"]), expected)
            self.assertEqual(data["places"]["Puerto Bajo"], {"lat": 43.5, "lon": -5.7, "name": "Puerto Bajo"})
        # Pau's birthplace and that of the document that cites him are his facts: not in the public version
        self.assertNotIn("Monte Medio", html)
        self.assertNotIn("Río Hondo", html)
        data = json.loads((build / "private" / "data.json").read_text(encoding="utf-8"))
        self.assertEqual(data["places"]["Monte Medio"]["name"], "Monte Medio")  # without a name, the text


class HistoricEvents(unittest.TestCase):
    """The events of the timeline: the language's by default; `historic_events` in families.yml replaces them."""

    def events(self, extra_config=""):
        if not (CODE / "web" / "dist" / "web.js").is_file():
            self.skipTest("the interface is not compiled: run `make web`")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root, extra_config=extra_config)
            run(root, "references")
            out = root / "build" / "web"
            result = run(root, "build_site", "--only", "local", "-o", str(out))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return read_data(out / "index.html")[0]["events"]

    def test_the_language_default(self):
        events = self.events()
        self.assertIn({"from": 1914, "to": 1918, "label": "Primera Guerra Mundial"}, events)
        self.assertEqual(len(events), 5)

    def test_the_tree_list_replaces_the_default(self):
        events = self.events("historic_events:\n  - {from: 1855, to: 1860, label: Gran sequía}\n"
                             "  - {from: 1907, label: Riada}\n")
        self.assertEqual(events, [{"from": 1855, "to": 1860, "label": "Gran sequía"},
                                  {"from": 1907, "to": 1907, "label": "Riada"}])

    def test_an_empty_list_is_no_events(self):
        self.assertEqual(self.events("historic_events: []\n"), [])


class LinkPreview(unittest.TestCase):
    """The collage of deceased people for the preview of shared links (scripts/share_image.py)."""

    URL = "https://arbre.example.org"

    def build(self, extra_config):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        make_tree(root, main="anna-ferrer-roca", living=True, extra_config=extra_config)
        run(root, "references")
        return root, run(root, "build_site", "--only", "site")

    def test_collage_of_the_closest_deceased_ancestors(self):
        root, result = self.build(f"site_url: {self.URL}/\n")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("link preview: 1 portraits of deceased people", result.stdout)
        public = root / "build" / "public"
        meta = json.loads((public / "share" / "meta.json").read_text(encoding="utf-8"))
        image = next((public / "share").glob("og-*.jpg"))
        self.assertEqual(meta["image"], f"{self.URL}/share/{image.name}")
        self.assertEqual((meta["width"], meta["height"]), (1200, 630))
        data = image.read_bytes()
        self.assertEqual(data[:3], b"\xff\xd8\xff")
        self.assertNotIn(b"Exif", data)  # no metadata
        _, html = read_data(public / "index.html")
        self.assertIn(f'<meta property="og:image" content="{self.URL}/share/{image.name}">', html)
        self.assertIn('<meta name="twitter:card" content="summary_large_image">', html)
        self.assertIn("leak check: 0 leaks", result.stdout)

    def test_without_site_url_there_is_no_preview(self):
        root, result = self.build("")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("`site_url` is missing", result.stdout)
        self.assertFalse((root / "build" / "public" / "share").exists())
        _, html = read_data(root / "build" / "public" / "index.html")
        self.assertNotIn("og:image", html)
        self.assertNotIn("<!--SHARE-->", html)

    def test_it_can_be_turned_off(self):
        root, result = self.build(f"site_url: {self.URL}\nlink_preview: false\n")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("link preview", result.stdout)
        self.assertFalse((root / "build" / "public" / "share").exists())
        _, html = read_data(root / "build" / "public" / "index.html")
        self.assertNotIn("og:", html)

    def test_a_living_person_in_the_list_stops_the_build(self):
        root, result = self.build(f"site_url: {self.URL}\nshare_image: [anna-ferrer-roca]\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("share_image: anna-ferrer-roca is a living person", result.stderr)
        self.assertFalse((root / "build" / "public").exists())

    def test_the_list_chooses_the_portraits(self):
        root, result = self.build(f"site_url: {self.URL}\nshare_image: [pau-ferrer-puig]\n")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(next((root / "build" / "public" / "share").glob("og-*.jpg")).is_file())


class Folders(unittest.TestCase):
    """`make folders` on a tree with only its families.yml: the data folders of `paths`, with a .gitkeep."""

    def test_creates_the_configured_folders(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root, people="gente", sources="fuentes")
            for name in ("gente", "fuentes", "research", "portraits"):
                shutil.rmtree(root / name)
            missing = run(root, "validate")
            self.assertIn("paths.people: the folder «gente» does not exist (`make folders` creates it)",
                          missing.stdout + missing.stderr)
            result = run(root, "folders")
            self.assertEqual(result.returncode, 0, result.stderr)
            for name in ("gente", "fuentes", "research", "portraits"):
                self.assertTrue((root / name / ".gitkeep").is_file(), name)
            self.assertFalse((root / "people").exists())
            self.assertEqual(run(root, "folders").stdout, "")


class Autolink(unittest.TestCase):
    """The addresses written as plain text in the markdown of the notes become links (build_site.markdown_renderer),
    never inside a link nor in code, without the punctuation around them."""

    CASES = {
        "See https://example.org/a.": '<p>See <a {ext} href="https://example.org/a">https://example.org/a</a>.</p>',
        "Two: https://example.org/a, and (http://example.com/b?x=1&y=2).":
            '<p>Two: <a {ext} href="https://example.org/a">https://example.org/a</a>, and '
            '(<a {ext} href="http://example.com/b?x=1&amp;y=2">http://example.com/b?x=1&amp;y=2</a>).</p>',
        "«https://example.org/wiki/Villa_(Ficticia)»":
            '<p>«<a {ext} href="https://example.org/wiki/Villa_(Ficticia)">'
            'https://example.org/wiki/Villa_(Ficticia)</a>»</p>',
        "**https://example.org/c**": '<p><strong><a {ext} href="https://example.org/c">https://example.org/c</a>'
                                     '</strong></p>',
        "[https://example.org/d](https://example.org/d)":
            '<p><a {ext} href="https://example.org/d">https://example.org/d</a></p>',
        "[see https://example.org/e here](https://example.org/f)":
            '<p><a {ext} href="https://example.org/f">see https://example.org/e here</a></p>',
        "`https://example.org/g`": "<p><code>https://example.org/g</code></p>",
        "<https://example.org/h>": '<p><a {ext} href="https://example.org/h">https://example.org/h</a></p>',
        "ftp://example.org and www.example.org and https://": "<p>ftp://example.org and www.example.org and https://</p>",
        "[Jaume](../people/jaume-ferrer-soler.md) https://example.org/i":
            '<p><a href="#" data-person="jaume-ferrer-soler">Jaume</a> '
            '<a {ext} href="https://example.org/i">https://example.org/i</a></p>',
    }

    def test_bare_addresses_become_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            # A script with the dependencies of build_site, which renders each case
            header = (CODE / "scripts" / "build_site.py").read_text(encoding="utf-8").split("# ///\n")[0] + "# ///\n"
            (root / "render.py").write_text(header + f"""
import json, sys
sys.path.insert(0, {str(CODE / "scripts")!r})
import arbre, build_site
people, _ = arbre.load_people()
md = build_site.markdown_renderer(people, {{}}, set())
print(json.dumps([md(t) for t in json.loads(sys.stdin.read())]))
""", encoding="utf-8")
            env = {**os.environ, "ARBRE_ROOT": str(root)}
            result = subprocess.run(["uv", "run", "--quiet", "--script", str(root / "render.py")], cwd=root, env=env,
                                    input=json.dumps(list(self.CASES)), capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        ext = 'target="_blank" rel="noopener noreferrer"'
        for (text, expected), got in zip(self.CASES.items(), json.loads(result.stdout)):
            self.assertEqual(got, expected.format(ext=ext), text)


class OpenItems(unittest.TestCase):
    """history.open_items: every top-level bullet of a family section is an open item; the `[ ]` of the old task-list
    format does not change its key, and an old `[x]` one is closed."""

    OLD = "# P\n\n## Ferrer family\n\n- [ ] **Birth of Marc**: his\n  certificate.\n- [x] **Done one** solved.\n"
    NEW = "# P\n\n## Ferrer family\n\n- **Birth of Marc**: his\n  certificate.\n\n## General\n\n- **Ask**: the books.\n"

    def test_old_and_new_format_are_the_same_item(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            header = (CODE / "scripts" / "build_site.py").read_text(encoding="utf-8").split("# ///\n")[0] + "# ///\n"
            (root / "items.py").write_text(header + f"""
import json, sys
sys.path.insert(0, {str(CODE / "scripts")!r})
import history
old, new = json.loads(sys.stdin.read())
print(json.dumps([history.open_items(old), history.open_items(new)]))
""", encoding="utf-8")
            env = {**os.environ, "ARBRE_ROOT": str(root)}
            result = subprocess.run(["uv", "run", "--quiet", "--script", str(root / "items.py")], cwd=root, env=env,
                                    input=json.dumps([self.OLD, self.NEW]), capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        old, new = json.loads(result.stdout)
        # `- [ ] X` and `- X` are the same item, and the `[x]` one is closed
        self.assertEqual(old, {"Birth of Marc": "ferrer"})
        self.assertEqual(new, {"Birth of Marc": "ferrer", "Ask": "general"})
        # Removing an item from the list closes it (see History.test_whole_history)
        self.assertEqual(sorted(old.keys() - new.keys()), [])


class Lookup(unittest.TestCase):
    """lookup.py: a person's card, a source's card, a branch and the text search, from the notes as they are."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        make_tree(cls.root)
        (cls.root / "research" / "pendientes.md").write_text(
            "# Pendientes\n\n## Ferrer family\n\n### Ferrer and Puig\n\n"
            "- **Death of Pau Ferrer Puig**: ask\n  the parish.\n- **Unrelated**: nothing.\n", encoding="utf-8")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def lookup(self, *args):
        result = run(self.root, "lookup", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def test_person(self):
        out = self.lookup("pau ferrer")
        self.assertIn("## Pau Ferrer Puig [pau-ferrer-puig] — people/pau-ferrer-puig.md", out)
        self.assertIn("father: jaume-ferrer-soler · mother: rosa-puig-vidal · proven", out)
        self.assertIn("sources (2; * pending review): F001 F002*", out)
        # The item names him (in two lines), the other does not; in one line, without markdown
        self.assertIn("research/pendientes.md:7 · Death of Pau Ferrer Puig: ask the parish.", out)
        self.assertNotIn("Unrelated", out)
        self.assertIn("children: pau-ferrer-puig", self.lookup("jaume-ferrer-soler"))

    def test_wider_person(self):
        out = self.lookup("--family", "--sources", "--items", "pau-ferrer-puig")
        self.assertIn("father: Jaume Ferrer Soler [jaume-ferrer-soler] (1890 –)", out)
        self.assertIn("F002 — Newspaper notice (1920, review pendiente)", out)
        self.assertIn("research/pendientes.md:7 · Ferrer family › Ferrer and Puig\n"
                      "  **Death of Pau Ferrer Puig**: ask the parish.", out)
        self.assertNotIn("linked from", out)
        self.assertIn("children: Pau Ferrer Puig [pau-ferrer-puig] (1921 –)", self.lookup("--full", "jaume-ferrer-soler"))

    def test_source(self):
        out = self.lookup("f001")
        self.assertIn("## F001 — Marriage record — sources/F001.md", out)
        self.assertIn("type Acta · date 1920", out)
        self.assertIn("files: 1", out)
        self.assertIn("cited by: jaume-ferrer-soler", out)
        self.assertIn("research/incoherencias.md:5 · Fictional item (F001).", out)
        self.assertIn("files (1): sources/F001/acta.png", self.lookup("--sources", "F001"))

    def test_branch(self):
        out = self.lookup("rama/puig")
        self.assertIn("## Branch Puig [puig]", out)
        self.assertIn("- Rosa Puig Vidal [rosa-puig-vidal] (1892 –) · 1 sources", out)
        self.assertIn("research/pendientes.md:7 · Death of Pau Ferrer Puig: ask the parish.", out)

    def test_several_people_and_text(self):
        # Two people are Puig: a card each; one query per argument; no person: the lines of the notes
        out = self.lookup("puig", "parish")
        self.assertIn("## Rosa Puig Vidal [rosa-puig-vidal]", out)
        self.assertIn("## Pau Ferrer Puig [pau-ferrer-puig]", out)
        self.assertIn("## Text «parish»\nresearch/pendientes.md\n  8: the parish.", out)
        self.assertIn("## Text «Puig»\npeople/pau-ferrer-puig.md — Pau Ferrer Puig", self.lookup("--text", "Puig"))


class InvalidConfig(unittest.TestCase):
    def check(self, message, **tree):
        with tempfile.TemporaryDirectory() as tmp:
            make_tree(Path(tmp), **tree)
            result = run(Path(tmp), "validate")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr + result.stdout)

    def test_unknown_language(self):
        self.check("language: unknown «xx» (available: es)", language="xx")

    def test_folder_outside_the_root(self):
        self.check("paths.people: «data/people» is not the name of a folder at the root", people="data/people")

    def test_site_url_and_share_image(self):
        self.check("site_url: «arbre.example.org» is not an http(s) address", extra_config="site_url: arbre.example.org\n")
        self.check("share_image: expected a list of slugs", extra_config="share_image: pau\n")
        self.check("link_preview: expected true or false", extra_config="link_preview: maybe\n")
        self.check("share_image names a missing person: nobody", extra_config="share_image: [nobody]\n")

    def test_history_months(self):
        self.check("history_months: expected a whole number of months, from 0 (no history) to 120",
                   extra_config="history_months: -1\n")
        self.check("history_months: expected a whole number", extra_config="history_months: yes\n")

    def test_historic_events(self):
        self.check("historic_events: expected a list of {from, to, label}", extra_config="historic_events: Guerra\n")
        self.check("historic_events[0]: expected a mapping with from, to and label",
                   extra_config="historic_events: [1914]\n")
        self.check("historic_events[0]: unknown keys: until (valid: from, to, label)",
                   extra_config="historic_events: [{from: 1914, until: 1918, label: War}]\n")
        self.check("historic_events[0]: «from» must be a year (a whole number)",
                   extra_config="historic_events: [{from: c. 1914, label: War}]\n")
        self.check("historic_events[1]: «to» must be a year (a whole number)",
                   extra_config="historic_events: [{from: 1800, label: Flood}, {from: 1914, to: yes, label: War}]\n")
        self.check("historic_events[0]: «from» (1918) is after «to» (1914)",
                   extra_config="historic_events: [{from: 1918, to: 1914, label: War}]\n")
        self.check("historic_events[0]: missing «label» (text)", extra_config="historic_events: [{from: 1914, label: ' '}]\n")

    def test_two_roles_in_one_folder(self):
        self.check("paths: two roles share the same folder", research="sources")

    def test_missing_families_yml(self):
        with tempfile.TemporaryDirectory() as tmp:
            make_tree(Path(tmp))
            (Path(tmp) / "families.yml").unlink()
            result = run(Path(tmp), "validate")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("families.example.yml", result.stderr)


def git(root, *args, date=None):
    """A git command in the fictional tree, with a fixed author and, with `date`, that day as its date."""
    env = {**os.environ, "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "test@example.org",
           "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "test@example.org"}
    if date:
        env["GIT_AUTHOR_DATE"] = env["GIT_COMMITTER_DATE"] = f"{date.isoformat()}T12:00:00"
    return subprocess.run(["git", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", *args], cwd=root,
                          env=env, capture_output=True, text=True, check=True).stdout


class History(unittest.TestCase):
    """«Novedades» (scripts/history.py): the changes of the data, day by day, from the Git history of a fictional tree
    whose main person is living; and that the public version has nothing of the living nor of the private documents."""

    LIVING = PublicSite.LIVING + ["diploma", "farera", "birth of marc"]

    @classmethod
    def setUpClass(cls):
        if not shutil.which("git"):
            raise unittest.SkipTest("git is not installed")
        if not (CODE / "web" / "dist" / "web.js").is_file():
            raise unittest.SkipTest("the interface is not compiled: run `make web`")
        cls.tmp = tempfile.TemporaryDirectory()
        root = cls.root = Path(cls.tmp.name)
        today = dt.date.today()
        cls.days = [(today - dt.timedelta(days=n)).isoformat() for n in (5, 3, 1)]
        days = [dt.date.fromisoformat(d) for d in cls.days]
        make_tree(root, main="anna-ferrer-roca", living=True)
        (root / ".gitignore").write_text("build/\n", encoding="utf-8")
        run(root, "references")
        git(root, "init", "-q")
        git(root, "add", "-A")
        git(root, "commit", "-qm", "start", date=days[0])
        # Day 2, in two commits: a public document (1910) cited by Jaume, who gets his death place; a private one
        # cited by Anna, who gets an occupation; a new person; and the research documents change
        people, sources, research = root / "people", root / "sources", root / "research"
        sources.joinpath("F004.md").write_text(source("F004", "Death record of Jaume", date=1910), encoding="utf-8")
        sources.joinpath("F005.md").write_text(source("F005", "Diploma of the granddaughter", date=1985),
                                               encoding="utf-8")
        edit(people / "jaume-ferrer-soler.md", ("sex: M\n", "sex: M\ndeath_place: Puerto Bajo\n"),
             ('"[[F001]]"]', '"[[F001]]", "[[F004]]"]'))
        edit(people / "anna-ferrer-roca.md", ("sex: F\n", "sex: F\noccupation: Farera\n"),
             ('"[[F003]]"]', '"[[F003]]", "[[F005]]"]'))
        git(root, "add", "-A")
        git(root, "commit", "-qm", "two documents", date=days[1])
        people.joinpath("josep-puig.md").write_text(person("Josep", "Puig", "M", 1880, ["F001"], died=1950),
                                                    encoding="utf-8")
        people.joinpath("pere-soler.md").write_text(person("Pere", "Soler", "M", 1850, ["F001"], died=1910),
                                                    encoding="utf-8")
        research.joinpath("pendientes.md").write_text(
            "# Pendientes\n\n## Ferrer family\n\n- **Birth of Marc Ferrer Roca**: his "
            "certificate.\n\n## General\n\n- **Ask the archive**: the parish books.\n", encoding="utf-8")
        run(root, "references")
        git(root, "add", "-A")
        git(root, "commit", "-qm", "a person", date=days[1])
        # Day 3: F002 approved, and Josep renamed with his second surname
        edit(sources / "F002.md", ("review: pendiente", "review: revisada"))
        git(root, "mv", "people/josep-puig.md", "people/josep-puig-vidal.md")
        edit(people / "josep-puig-vidal.md", ("surnames: Puig\n", "surnames: Puig Vidal\n"))
        # Pere's note is rewritten under his full name: too different for Git, the same person by his name
        (people / "pere-soler.md").unlink()
        people.joinpath("pere-soler-roca.md").write_text(person(
            "Pere", "Soler Roca", "M", "c. 1851", ["F001", "F004"], died=1911,
            body="\n".join(f"Line {n} of a biography written anew." for n in range(40))), encoding="utf-8")
        run(root, "references")
        git(root, "add", "-A")
        git(root, "commit", "-qm", "review", date=days[2])
        cls.build = run(root, "build_site")
        cls.whole = read_data(root / "build" / "web" / "index.html")[0]["history"]
        cls.public, cls.public_html = read_data(root / "build" / "public" / "index.html")
        cls.private = json.loads((root / "build" / "private" / "data.json").read_text(encoding="utf-8"))["history"]

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def day(self, history, n):
        return next(e for e in history if e["date"] == self.days[n])

    def test_built(self):
        self.assertEqual(self.build.returncode, 0, self.build.stdout + self.build.stderr)
        self.assertIn("history: 3 days with changes", self.build.stdout)
        self.assertIn("leak check: 0 leaks", self.build.stdout)
        self.assertTrue((self.root / "build" / "history-cache.json").is_file())

    def test_whole_history(self):
        self.assertEqual([e["date"] for e in self.whole], self.days[::-1])
        first, second, third = (self.day(self.whole, n) for n in range(3))
        self.assertTrue(first["first"])
        self.assertEqual(first["peopleAdded"], ["anna-ferrer-roca", "jaume-ferrer-soler", "marc-ferrer-roca",
                                                "pau-ferrer-puig", "rosa-puig-vidal"])
        self.assertEqual(first["docsAdded"], ["F001", "F002", "F003"])
        self.assertEqual(second["docsAdded"], ["F004", "F005"])
        # Josep was added that day, with the slug he has now
        self.assertEqual(second["peopleAdded"], ["josep-puig-vidal", "pere-soler-roca"])
        changed = {c["id"]: c for c in second["peopleChanged"]}
        self.assertEqual(changed["jaume-ferrer-soler"], {"id": "jaume-ferrer-soler", "fields": ["deathPlace"],
                                                         "sources": ["F004"]})
        self.assertEqual(changed["anna-ferrer-roca"]["fields"], ["occupation"])
        # Each item with the family of its section
        self.assertEqual(second["research"], [
            {"note": "pendientes", "text": "Ask the archive", "family": "general", "resolved": False},
            {"note": "pendientes", "text": "Birth of Marc Ferrer Roca", "family": "ferrer", "resolved": False},
            # Removed from the list = solved
            {"note": "pendientes", "text": "Nothing yet.", "family": "ferrer", "resolved": True}])
        self.assertEqual(third["docsReviewed"], ["F002"])
        self.assertEqual(third["peopleRenamed"], [{"from": "Josep Puig", "to": "josep-puig-vidal"},
                                                  {"from": "Pere Soler", "to": "pere-soler-roca"}])
        self.assertEqual(third["peopleChanged"], [
            {"id": "josep-puig-vidal", "fields": ["name"], "sources": []},
            {"id": "pere-soler-roca", "fields": ["name", "born", "died", "biography"], "sources": ["F004"]}])
        self.assertEqual((third["peopleAdded"], third["peopleRemoved"]), ([], []))
        self.assertEqual(self.private, self.whole)

    def test_public_history(self):
        history = self.public["history"]
        second, third = self.day(history, 1), self.day(history, 2)
        self.assertEqual(second["docsAdded"], ["F004"])
        self.assertEqual([c["id"] for c in second["peopleChanged"]], ["jaume-ferrer-soler"])
        self.assertEqual((second["research"], third["peopleRenamed"]), ([], []))
        self.assertNotIn("anna-ferrer-roca", self.day(history, 0)["peopleAdded"])
        text = json.dumps(history, ensure_ascii=False).lower()
        for word in [*self.LIVING, "f005", "f003", "nothing yet", "josep puig\""]:
            self.assertNotIn(word, text)
        for word in self.LIVING:
            self.assertNotIn(word, self.public_html.lower())

    def test_people_families(self):
        whole = {p["id"]: p["families"] for p in read_data(self.root / "build" / "web" / "index.html")[0]["people"]}
        self.assertEqual((whole["jaume-ferrer-soler"], whole["anna-ferrer-roca"]), (["ferrer"], ["ferrer"]))
        # The living of the public version are a «Persona viva» box: no family either
        public = [p for p in self.public["people"] if p["living"]]
        self.assertTrue(public)
        self.assertEqual({tuple(p["families"]) for p in public}, {()})

    def test_cache_version(self):
        """The cache of the days is used while its version is the current one, and an older one is recomputed (its
        research items had no family)."""
        cache_path = self.root / "build" / "history-cache.json"
        fresh = json.loads(cache_path.read_text(encoding="utf-8"))
        out = self.root / "build" / "cache-web"

        def build(version):
            cache = json.loads(json.dumps(fresh))
            cache["version"] = version
            for raw in cache["days"].values():
                for item in raw["researchOpened"]:
                    item["text"] = "Stale item"
                    if version != fresh["version"]:
                        del item["family"]
            cache_path.write_text(json.dumps(cache), encoding="utf-8")
            result = run(self.root, "build_site", "--only", "local", "-o", str(out))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return json.dumps(read_data(out / "index.html")[0]["history"])

        self.assertIn("Stale item", build(fresh["version"]))
        history = build(fresh["version"] - 1)
        self.assertNotIn("Stale item", history)
        self.assertIn('"family": "general"', history)
        self.assertEqual(json.loads(cache_path.read_text(encoding="utf-8"))["version"], fresh["version"])

    def test_shallow_clone_and_no_history(self):
        clone = self.root / "build" / "clone"
        subprocess.run(["git", "clone", "-q", "--depth", "1", f"file://{self.root}", str(clone)], check=True)
        result = run(clone, "build_site", "--only", "local", "-o", str(clone / "build" / "web"))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(read_data(clone / "build" / "web" / "index.html")[0]["history"], [])
        families = clone / "families.yml"
        families.write_text(families.read_text(encoding="utf-8") + "history_months: 0\n", encoding="utf-8")
        shutil.rmtree(clone / ".git")
        result = run(clone, "build_site", "--only", "local", "-o", str(clone / "build" / "web"))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("history: no Git history", result.stdout)


def edit(path, *replacements):
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        assert old in text, (path, old)
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")


class DemoTree(unittest.TestCase):
    """The fictional tree of scripts/demo.py (`make demo`): always the same (its Git history included), it validates
    without errors or warnings, and its whole web, public version, history and leak check included, is built."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name) / "demo"
        cls.today = dt.date.today().isoformat()
        cls.made = subprocess.run(["uv", "run", "--quiet", str(CODE / "scripts" / "demo.py"), str(cls.root),
                                   "--today", cls.today], capture_output=True, text=True)
        cls.refs = run(cls.root, "references")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_validate(self):
        self.assertEqual(self.made.returncode, 0, self.made.stderr)
        result = run(self.root, "validate")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("0 errors, 0 warnings", result.stdout)

    def test_deterministic(self):
        again = Path(self.tmp.name) / "again"
        result = subprocess.run(["uv", "run", "--quiet", str(CODE / "scripts" / "demo.py"), str(again),
                                 "--today", self.today], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        run(again, "references")

        def tree(root):
            return sorted(f.relative_to(root) for f in root.rglob("*")
                          if f.is_file() and not {"build", ".git"} & set(f.relative_to(root).parts))
        files = tree(self.root)
        self.assertEqual(files, tree(again))
        for f in files:
            self.assertEqual((self.root / f).read_bytes(), (again / f).read_bytes(), f)
        # The same commits, with the same dates and author: the same hashes
        head = [subprocess.run(["git", "-C", str(r), "rev-parse", "HEAD"], capture_output=True, text=True).stdout
                for r in (self.root, again)]
        self.assertTrue(head[0].strip())
        self.assertEqual(head[0], head[1])

    def test_refuses_a_folder_it_did_not_write(self):
        other = Path(self.tmp.name) / "other"
        other.mkdir()
        (other / "notes.md").write_text("mine", encoding="utf-8")
        result = subprocess.run(["uv", "run", "--quiet", str(CODE / "scripts" / "demo.py"), str(other)],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((other / "notes.md").read_text(encoding="utf-8"), "mine")

    def test_build_site(self):
        if not (CODE / "web" / "dist" / "web.js").is_file():
            self.skipTest("the interface is not compiled: run `make web`")
        out = self.root / "build"
        result = run(self.root, "build_site", "-o", str(out / "web"), "--public", str(out / "public"),
                     "--private", str(out / "private"), "--originals", "sources/")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data, _ = read_data(out / "web" / "index.html")
        self.assertTrue(60 <= len(data["people"]) <= 100, len(data["people"]))
        self.assertEqual(len({p["gen"] for p in data["people"]}), 6)
        self.assertEqual(len(data["families"]), 2)
        self.assertTrue(any(d["review"] == "pendiente" for d in data["docs"]))
        self.assertTrue(any(f["url"].startswith("sources/F") for d in data["docs"] for f in d["files"]))
        self.assertTrue(all(any(p[k] == c for p in data["people"]) for k, c in (("conf", "proven"),
                                                                               ("conf", "probable"))))
        # Every place of the tree is on the map
        places = {x for p in data["people"] for x in (p["birthPlace"], p["deathPlace"]) if x}
        self.assertEqual(places - set(data["places"]), set())
        public, _ = read_data(out / "public" / "index.html")
        self.assertTrue(any(p["living"] for p in public["people"]))
        # Portraits of the dead only, and a history with every kind of change
        self.assertTrue(10 <= sum(1 for p in data["people"] if p["photo"]))
        self.assertFalse([p["id"] for p in public["people"] if p["photo"] and p["living"]])
        history = data["history"]
        self.assertEqual(len(history), 8)
        self.assertTrue(history[-1]["first"])
        for key in ("docsAdded", "docsReviewed", "docsUpdated", "peopleAdded", "peopleChanged", "peopleRenamed"):
            self.assertTrue(any(e[key] for e in history[:-1]), key)
        research = [r for e in history for r in e["research"]]
        self.assertTrue(any(r["resolved"] for r in research) and any(not r["resolved"] for r in research))


if __name__ == "__main__":
    if not shutil.which("uv"):
        raise SystemExit("uv is needed to run the scripts")
    unittest.main(verbosity=2)
