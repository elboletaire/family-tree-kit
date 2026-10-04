# Repository Guidelines

**If there is no `families.yml`**, before anything else read and follow `.agents/skills/start-tree/SKILL.md`: the tree
has not been started yet.

**Read `TREE.md` if it exists**: it holds this tree's own conventions (its language, its folders, its key sources,
where its originals come from, its commit language). When it and this file disagree on something specific to the
tree, `TREE.md` wins; this file is the engine's contract, shared by every tree made from the template.

A family tree kept as code: one markdown note per person and per document. The content (biographies,
transcriptions, research notes, the website) is in the tree's language, `language` in `families.yml`; the frontmatter
keys are in English. After any change in the people or sources folders, run `make validate` (it must end with 0
errors).

## Structure

The data folders are named in `paths` of `families.yml` (see "Language and folders"); here they are cited by their
default names, `people/`, `sources/`, `research/` and `portraits/`.

- `people/<slug>.md` — one person.
- `sources/F0xx.md` — one document; its originals in `sources/F0xx/` (Git LFS, never edited).
- `research/` — `incoherencias.md`, `pendientes.md`, `descartados.md` (see "Rules"), `revision.md` (generated) and, if
  the originals come from a shared folder, `drive-manifest.tsv` (see "Updating from a shared folder").
- `portraits/` — crops of photos used in the `photo` field.
- `places.yml` — coordinates of the places for the website's map (see "Places").
- `families.yml` — language, data folders, families, branches (with their colour and founder), groups of branches and
  the website's main person. See "Language and folders" and "Families and branches". `families.example.yml` is the
  template, with a fictional family, to start a new tree.
- `templates/` — the person template for Obsidian (`.obsidian/templates.json`).
- `scripts/` — Python with inline dependencies (PEP 723), common logic in `arbre.py` and the texts the family reads
  (revision.md, website data, report, GEDCOM) in `i18n_<language>.py`. `build_site.py` generates the website data and
  embeds them, with the compiled interface, in `build/web/index.html`, and the site's pair: `build/public/` and
  `build/private/` (see "Public version"); `privacy.py` decides what is public and `leak_check.py` is the leak check; `share_image.py` makes the collage of the
  link preview (see "Public version"); `history.py` reads «Novedades» from the Git history (see "What's new");
  `references.py` regenerates the generated sections and `report.py` makes the report; `geocode.py` fills in
  `places.yml`; `folders.py` creates the data folders of `paths`; `config.py` prints a value of `families.yml` for the shell scripts; `check_template.py` checks that
  no name of the family is in the engine's files (see "Engine and data"); `demo.py` writes the fictional demo tree
  (Faker with a fixed seed; real towns, so that its map works; portraits drawn with Pillow, never real photos; and a
  Git repository with a few weeks of history, dated back from the day it runs, for «Novedades»).
- `web/` — the website's interface in TypeScript with Solid (JSX; pnpm, vite, vitest): `src/main.tsx` (entry),
  `App.tsx`, `router.ts` (hash `#view/focus[/p:slug|d:F0xx|r:name]` and history, with signals; the views' segments
  are in Spanish, `#arbol`, `#abanico`…, and `VIEW_SEGMENT` translates them to the internal names), `state.ts` (focused
  person and kinship), `session.ts` (the lock of the site), `family.ts` (family chosen in the research documents),
  `components/` (top bar, search, side panel, chips, cards, viewer, tooltip and `Html.tsx`, the only one that uses
  `innerHTML`: for the HTML that `build_site.py` already generates), `panels/` (person, document and research panels)
  and `views/` (`Home`, `Tree`, `Fan`, `Timeline`, `Voyage`, `Map` (`#mapa`, with Leaflet), `Documents` and `News`
  (`#novedades`), with their DOM-free computations in `fanLayout.ts`, `timelineLayout.ts`, `voyageEvents.ts`,
  `mapLayout.ts` and `newsLayout.ts`). All the texts
  the family sees are in `src/i18n/<language>.ts`, and `src/i18n/index.ts` picks the dictionary by the `<html lang>`
  that `build_site.py` writes. `src/types.ts` is the shape of the `DATA` that `build_site.py` generates, and
  `template.html` the page with the markers it fills in. Solid, d3 (scales, forces, zoom and drag), family-chart
  (which draws its own DOM) and Leaflet (with the world-atlas coastline for when there is no network) come from npm
  and go inside the bundle (`web/dist/web.js` and `web.css`); only the map tiles come from OpenStreetMap. Tests in
  `web/test/` (vitest and @solidjs/testing-library, with a fictional family in `fixture.ts`) and `web/e2e/`
  (Playwright).
- `deploy/` — server (`server.py` and its `Dockerfile`: everything behind a password or, with `PUBLIC_SITE=1`, the
  public version for everyone and the private part with a password), the image that builds the website
  (`build.Dockerfile`: Node, pnpm and uv) and the server's `post-receive` hook.
- `docs/screenshots/` — the screenshots of the READMEs, taken from the demo (`make screenshots`, with
  `web/screenshots/`).
- `.github/workflows/demo.yml` — builds the demo and publishes it on GitHub Pages; it only runs in the public template
  (`elboletaire/family-tree-kit`), never in a family's repository.
- `tests/` — test of the scripts on a fictional tree, in a temporary folder and with the default folders
  (`ARBRE_ROOT` points the scripts to another tree), the public version and «Novedades» (on a scratch Git repository)
  included; of the server (`test_server.py`); and of the protection of the template (`test_template.py`:
  `check_template.py` and the `pre-push` hook, on scratch git repositories with a fictional family).

## Commands

- `make folders` — creates the data folders of `paths` that do not exist yet, with a `.gitkeep` (the template has
  none: their names are the tree's); `make references`, and so every target that reads the data, runs it first.
- `make references` (or `make refs`) — regenerates the «Referencias» / «Personas mencionadas» sections and
  `research/revision.md`.
- `make validate` — runs `refs` and checks links, dates, reciprocity of spouses, files and cycles; warns (without
  error) about the places without coordinates in `places.yml`.
- `make places` — looks up in Nominatim the places missing from `places.yml` (`make html` and `make public` run it).
- `make web` — compiles the interface (`web/dist/`); needs Node 22 and pnpm. `make html` already compiles it.
- `make html` — generates `build/web/` (the whole website, to open without a server; 1-2 min the first time) and the
  site's pair, `build/public/` and `build/private/`, through the leak check; checks that their `DATA` matches
  `web/src/types.ts`. «Novedades» is read from the Git history of the data (cached in `build/history-cache.json`).
- `make test` (`tests/test_scripts.py`, `tests/test_server.py`, `tests/test_template.py` and vitest) · `make e2e` (Playwright on `build/web`,
  served with `python3 -m http.server 8765`, and on the site served by `deploy/server.py`, public on 8766 and closed
  on 8767; the first time, `cd web && pnpm exec playwright install chromium`).
- `make gedcom` · `make public` (only the site and `build/arbre-publico.ged`, both through the leak check) ·
  `make report` (or `make informe`: incoherencias and pendientes in PDF, of the family marked `default` in
  `families.yml`; `FAMILY=<key>` for another of its families or `FAMILY=all` for everything; `FAMILIA=` and `todo`
  still work).
- `make check-template` — `scripts/check_template.py`: no name of the family in the engine's files (see "Engine and
  data"). `make hooks` installs `scripts/hooks/pre-push`.
- `make demo` — the fictional tree of `scripts/demo.py` in `build/demo-tree` and its whole website in `build/demo`
  (with its scans in `build/demo/sources`), without touching this tree · `make screenshots` — the screenshots of the
  READMEs from it, in `docs/screenshots/` (Playwright, `web/screenshots.config.ts`).
- `uv run scripts/drive_diff.py "<folder>"` — what has changed in the shared folder since the last import.

## People

- **Slug** = file name = `name-surname1-surname2`: lowercase, no accents, with hyphens. If it collides, all the
  surnames (`jaume-ferrer-soler-puig-vidal`). Without a given name: `nn-surname`; without surnames: `name-nn`.
- **Frontmatter** (only these keys; the validator rejects any other):

| Key | Value |
|-----|-------|
| `given_name`, `surnames` | Text; `surnames` with all the documented surnames |
| `aliases` | Other forms of the name |
| `sex` | `M`, `F` or `U` |
| `born`, `died` | Date (see below) |
| `birth_place`, `death_place`, `occupation` | Text |
| `birth_order` | Integer: the family's numbering («3-Rosa» → 3) |
| `father`, `mother` | `"[[slug]]"` |
| `parents_confidence` | `proven` \| `probable`; required if there is `father` or `mother` |
| `siblings` | List of `"[[slug]]"`, **only** if the parents are not known |
| `spouses` | List of `"[[slug]]"`, **reciprocal** in both notes |
| `marriages` | List of `{spouse: slug, date, place}`, identical in both notes |
| `living` | `true` / `false`; omitted if not known |
| `tags` | `rama/<surname>` according to the branches the person descends from |
| `sources` | List of `"[[F0xx]]"`: the only record of the person-document relation |
| `photo` | `portraits/<slug>.jpg` |

- **Children are not written**: they are deduced from `father`/`mother`.
- **Body**: `# Full name`, `## Biografía` and `## Notas de investigación` (doubts, contradictions and the document
  that would be needed to continue a branch) — the section titles are in the tree's language. Every fact that comes
  from a document is cited next to it: `([F012](../sources/F012.md))`. The «Referencias» section is generated by
  `make refs`: it is not edited by hand.
- **Biography and research notes are for different readers.** The «Biografía» is the person's life told to the
  family: the facts in the order of their life, plainly («Nació el 3 de diciembre de 1983 en …»), each with its short
  citation. It never talks about the research itself: no folders, Drive, file names, former slugs, earlier versions
  of a fact, corrections, nor «según X, que dijo…» when it adds nothing (whether a source is pending review the website
  already shows). All of that — who gave each fact, how someone was identified, a correction that matters, doubts and
  what is missing — goes to «Notas de investigación»; trivial corrections (the same informant fixing a date the same
  day) are not recorded at all. The one exception: an important contradiction still unresolved (a testimony against a
  document not yet reviewed, two documents that disagree) is said in the biography in one sentence, so that the family
  knows the fact is not settled; the detail goes to the notes and `research/incoherencias.md`. Once resolved, the
  biography says the settled fact and the difference stays only in the notes.
- **Links**: in the body, relative markdown (`[Name](../people/slug.md)`); in the frontmatter, always `"[[slug]]"`
  (Obsidian only recognises wikilinks in properties).

## Places

`birth_place`, `death_place`, the `place` of the `marriages` and that of the sources are free text. For the map,
their coordinates go in `places.yml`, with the **exact** text as the key: `{lat, lon, name}` (`name`, the label of the
point), `{skip: true}` (not a concrete place: «Por teléfono», «? (probablemente…)») or `{}` (not found).
`make places` (`scripts/geocode.py`) queries Nominatim only for the missing ones, one request per second, removes
«?», «[?]» and «c.», tries variants (without parentheses, without the church or parish in front, the first of a
list) and only accepts towns and municipalities; it appends the lines at the end and does not touch the others.
Without network it writes nothing. After adding new places, **check what it found** (the comment of each line): small
villages and homonyms (the province and country must match the text) and lists of places (the first one is placed).
Corrections are made by hand on the same line, noting why in the comment. The ways of writing the same place with the
same coordinates make a single point. In the public version only the places of the facts it shows go on the map:
nothing of the living, of their weddings nor of the private documents (the leak check checks it).

## Public version

The website is published open, and the private data only reach the browser with a session: the public version is
generated in Python already without them (nothing is hidden with JavaScript nor encrypted in the client). Logic in
`scripts/privacy.py`.

- **Living person**: `living: true`, or without death (no `died`; `died: "?"` counts as deceased) and born less than
  **100 years** ago. The last day that can be their date counts (`1925` is 31-12-1925; `c.` and `¿…?` add 5 years;
  «después de …» always counts as recent). Without a birth date, it is estimated from the family (parents and children
  at 28 years, spouses and siblings of the same age; the dead, 60 years before their death) and counts as living if it
  falls less than 15 years from the limit. Whoever has no date and nobody with dates around, too, unless their note
  says `living: false`.
- In the public version, each living person is a «Persona viva» box in their place in the tree: only their links, with
  an opaque identifier (`living-<n>`, not the slug, which carries the name), without name, dates, places, photo,
  sources nor biography. The website opens through the eyes of `main`'s closest dead ancestor if `main` is alive.
- **Public documents**: more than 100 years old (without a date, no) and no living person among those who cite it,
  linked in its text or named in it or in its fields. Of them, only the note (transcription) and the thumbnail,
  without provenance nor who reviewed it; the originals (scans, PDF, the sources folder), always with a session.
- **Biographies of the dead**: without «Notas de investigación»; the links to the living are replaced by «persona
  viva»; and if they still name a living person (full name, given name and first surnames, alias, one of their dates,
  a place only the living have, or the given name of a close living relative that no dead person around also has),
  they are hidden entirely.
- The **research documents** (incoherencias, pendientes, revisión) are not in the public version.
- **Novedades** (see "What's new"): only the changes of deceased people and public documents, by their ids (the names
  and titles come from the public data); nothing of the living, of the people removed or renamed, of the research
  notes nor of the research documents, and no day that is a date of a living person.
- **Leak check** (`scripts/leak_check.py`, inside `build_site.py` and the deploy): searches every file of
  `build/public/` (text, file names and EXIF metadata), without accents or capitals, for the names, aliases, slugs,
  dates with month, places, occupations and map labels of the living, and the titles and files of the private
  documents; and that each place of `DATA.places` belongs to a public fact. If it finds anything, it fails and nothing
  is written (it stays in `build/public.tmp` to look at it). It excludes, and lists, what matches a dead person or a
  public document (a grandfather with the same name and first surname, a village where both were born, twins). It
  cannot see mentions by given name only outside the close family: if a biography talks about a living person that
  way, it has to be removed by hand.
- With the password, the website downloads `/private/data.json` (the whole tree) and draws itself again in the same
  view. If there is already a session (the `arbre_hint` cookie), on opening it waits for the private data before
  drawing anything.
- **Closed or public website**: `PUBLIC_SITE` in `.env` (by default `0`). With `0` the website is **all closed**:
  without a session, the server only gives its password page (neither the public version nor its images), and the open
  lock closes the session and goes back to that page. With `1`, the public version for everyone and the lock for the
  private part. To open it to the public: `PUBLIC_SITE=1` in `.env` and `docker compose up -d web`; to close it again,
  `PUBLIC_SITE=0` (or remove the line) and the same command. The public version is generated and goes through the
  leak check the same in both cases.
- **Link preview** (Open Graph, `scripts/share_image.py`): the public version's `index.html` carries `og:` and
  `twitter:` tags that point to a 1200x630 collage of portraits of **deceased** people (`share/og-<hash>.jpg`, with no
  metadata; it goes through the leak check like the rest). They are the ones in `share_image` of `families.yml` (a
  living person there stops the build) or, by default, the closest ancestors of `main` with a portrait (up to 8).
  Needs `site_url` in `families.yml` (absolute address, no final «/»); without it, or without portraits, there is
  no preview. **Opt-out:** `link_preview: false` in `families.yml`: no image, no tags and no exception in the closed
  mode. It is the one exception of the closed mode: `deploy/server.py` serves `/share/*.jpg` without a session
  and adds the same tags (from `share/meta.json`) to its login page, so that chat apps can show the preview of a
  shared link; nothing else of `share/` nor of the site is served. The tags are only in the public version, not in
  `build/web`.

## What's new

The website's «Novedades» view (`#novedades`), the «Historial de la ficha» of the person card and the documents of
«Últimos documentos añadidos» on the home come from the Git history of the data, not from the commit messages
(`scripts/history.py`, in `DATA.history`). For each day with commits along the first-parent line of the branch, the
notes at the end of the previous day are compared with those at the end of that day: sources added, approved
(`review` from `pendiente` to `revisada`), updated or removed; people added, removed, renamed (Git's rename detection)
or with changed facts (name, dates, places, parents, spouses, photo, biography, research notes) and new sources; and
the items of `incoherencias.md` and `pendientes.md` (each top-level bullet) that appeared or were removed (only in the private data).

- `history_months` (optional, in `families.yml`): how many months back, 6 by default; `0` turns it off.
- Without Git, outside a repository or in a shallow clone there is less or no history, never an error (the home then
  shows a sample of the documents by their own date). The deploy builds from a checkout without `.git`:
  `deploy/post-receive` mounts the bare repository in the build container (`ARBRE_GIT_DIR`, `ARBRE_GIT_REF`), whose
  image has Git.
- A day's changes only depend on its two commits: they are cached in `build/history-cache.json`.

## Dates

`1896-12-19` · `1896-12` · `1896` · `"c. 1844"` · `"antes de 1938-07-06"` · `"después de 1900"` ·
`"¿1938-07-06?"` (doubtful) · `"?"`. Times and details, in the biography. The date qualifiers are in Spanish whatever
the tree's language.

## Parentage confidence

- `proven`: a document states it (will, certificate, deed).
- `probable`: only the family's own tree, oral tradition or consistent evidence support it.
- `speculative`: **not recorded**; the hypothesis goes in «Notas de investigación» (the validator prevents it).

## Sources

Consecutive numbering (the next free `F0xx`). Frontmatter: `id`, `title`, `type`, `category`
(`genealogia` | `foto` | `arbol` | `contexto` | `patrimonio` | `ia`), `date`, `place`, `issuer`, `subject`,
`pages`, `status` (`documentado` | `pendiente` | `en-investigacion` | `indicio` | `no-fiable`), `origin`,
`priority`, `drive_path` and `files` (relative to the sources folder). Every file of `sources/F0xx/` must be in the
`files` of some note. Compilations have their own note with the table pages → notes. Transcriptions respect the
original spelling and mark doubtful readings with `[?]`.

**Review.** Optional keys `review` (`pendiente` | `revisada`) and `reviewed_by` (free text, e.g.
`"Name, 2026-10-02"`). A source without `review` is trusted: originals of the family archive or handed over by the
family. To approve a pending one, change it to `review: revisada` and fill in `reviewed_by`; if it turns out wrong,
delete the source and the data that depend on it, and record it in `research/descartados.md` (see "Rules"). The
state of each person is deduced from it (without a key of its own): «nueva, por revisar» if all their sources are
pending, «con datos por revisar» if any is.
`research/revision.md` lists the pending ones and what each one contributes, by families (according to the people who
cite them; logic in `person_families` and `source_family` of `scripts/arbre.py`); `make refs` generates it and it is
not edited by hand.

## Photos

The repository keeps photos as **evidence**, not as an album: complete albums go to the family's photo library, and
only a selection comes in here.

- **Living people: no photo.** Neither portraits nor group photos where a living person is a recognisable
  protagonist. Exception: if the only photo of a deceased person is with living people, it can be kept.
- **Deceased people:** a portrait for the `photo` field; perhaps one photo per stage of life (childhood,
  adolescence, adulthood, old age) to see what they looked like at different ages; and the photos that relate them to
  other people of the tree (wedding, family groups) when everyone identified has died and the photo contributes
  something (who was together, where, when).
- **Photographed documents** (announcements, drafts, funeral cards, letters): always, because they are documents.
- **Only certain identifications**: the file name or a written text says who it is, or the context leaves no doubt.
  Doubtful or only «probable» ones stay out, and the question goes to `research/pendientes.md` with the name of the
  album's file, so that the family can answer.
- If needed, the photo is cropped to leave the living out, and the source note says so.

## Language and folders

Two optional keys of `families.yml`, which `load_config` checks:

- `language` (by default `es`): the language of the texts the family reads, in `scripts/i18n_<language>.py` and
  `web/src/i18n/<language>.ts`. Only `es` exists for now; any other value is a validation error. A new language is a
  translated copy of both files (and its entry in `LANGUAGES` of `web/src/i18n/index.ts`). The URL segments
  (`VIEW_SEGMENT` in `web/src/router.ts`), the data values (`pendiente`, `revisada`, `genealogia`, `rama/`…) and the
  date qualifiers stay in Spanish.
- `paths`: the name of each data folder by its role: `people`, `sources`, `research` and `portraits` (by default,
  those same names). They are folders at the root, different from each other, and `make folders` creates them; the
  links generated (`../<sources>/F0xx.md`), the scripts, the website and the deploy come from here, and no code has
  the name of a data folder written in it. Changing them in an existing tree means moving the folders and rewriting the links in the body
  of the notes and the `photo` field (`.gitattributes` does not depend on them).

## Families and branches

`families.yml` keeps everything the code needs to know about specific families and people: neither the scripts nor
the website have names written in them. It is read by `scripts/arbre.py` (with `load_config`, which checks its shape)
and `build_site.py`, which passes it to the website in `DATA.families`, `DATA.branches` and `DATA.main`.

- `main`: the person through whose eyes the website opens.
- `site_url`, `share_image` and `link_preview` (optional): the site's address, the deceased in the link preview's
  collage and `false` to opt out of it (see "Public version").
- `history_months` (optional): how many months of «Novedades» (see "What's new").
- `families`: `key`, `label` (the website's selector), `title` (the `##` of `incoherencias.md` and `pendientes.md`),
  `of` (to count its documents: «de la familia …») and `default: true` in only one. `several`, `general`, `all` and
  `todo` are reserved.
- `branches`: the branches, in the order of the legend: `key` (the tag `rama/<key>`), `label`, `color` (`#rrggbb`),
  `founder` (slug) and `family`. `other_branch`: that of whoever does not descend from any.
- `groups`: the `###` of each family in `revision.md`: `family`, `title` and their `branches`.

`make validate` also checks that the founders and `main` exist. A new branch is added here and with the tag
`rama/<key>` in the people.

## Updating from a shared folder

If the family's originals live in a shared folder (Google Drive or similar), `research/drive-manifest.tsv` keeps the
path, size, md5 and destination of each file already imported. `TREE.md` says where the folder is and how to reach it.

1. `uv run scripts/drive_diff.py "<folder>"` lists the new, modified, moved and removed files.
2. For each new document: read it, create `sources/F0xx.md` with its transcription and copy the originals to
   `sources/F0xx/` (BMPs are converted to lossless PNG), update the people's notes and
   `incoherencias.md`/`pendientes.md`.
3. Record each file: `uv run scripts/drive_diff.py "<folder>" --record "<path in the folder>" "F0xx/<file>"` (or
   `"descartado: reason"`). Until it is recorded, it keeps showing up as new.
4. `make validate`, commit and push.

## Rules

- **Hierarchy of sources**, from most to least reliable: original documents (certificates, wills, deeds, parish
  records); direct testimony of relatives about their own generation; trees and lists compiled by the family, which
  are a summary made from documents, sometimes from others we do not have yet, and not a source of truth; and, last,
  AI-generated content, which is never a source. `TREE.md` names this tree's compiled trees.
- If a document contradicts a compiled tree, the document wins. If two documents contradict each other (above all on
  dates), do not choose blindly: use the one closest to the fact, explain it in the notes and record it in
  `research/incoherencias.md`. Data are not invented: the gaps go to `research/pendientes.md`.
- **Every open question is written down when it comes up.** Whatever a new document, an answer, a testimony or a
  search opens (who someone is, a doubtful reading that matters, a gap, something to ask the family) goes to
  `research/pendientes.md`, and a contradiction to `research/incoherencias.md`, in the same change that brings it and
  before telling the user. The notes of a person or a source can explain it, but the item is in those files: a
  question said only in the conversation is lost.
- **What is discarded is written down too.** A document or an identification the family rejects (a homonym, a record
  of someone else, a wrong reading) is deleted with every datum that depends on it, and recorded in
  `research/descartados.md`: what it was, where it was found (the URL or archive reference that would bring it back),
  who decided it and when, and why. It goes by families and branches like `pendientes.md`, and the «Notas de
  investigación» of the person it was attached to keep one line about it. Research reads that file before recording
  anything, so that a discarded document does not come back. It is not shown on the website.
- AI-generated content (`category: ia`) is **never** the source of a fact.
- `incoherencias.md` and `pendientes.md` go by families: a `##` for each family of `families.yml` (with its exact
  `title`), with a `###` per branch, and «General». Each new item goes in the family and branch of the people it
  affects; only what touches several goes in «General». An item is a plain top-level bullet (`- **Title** — text`, no
  checkbox) and is removed only once its answer is written where it belongs: the settled fact in the frontmatter and
  biography (with its source) and how it was settled in the notes, or what was ruled out deleted and recorded in
  `research/descartados.md`; removing an item without that loses the answer, and what only a pending source says
  does not settle it. The family `##` titles are not renamed: the website and
  `make report` filter by them (if one is renamed, its `title` in `families.yml` is changed at the same time).
- Every source found by automated or AI research (newspaper archives, gazettes, archive indexes) comes in with
  `review: pendiente`, and only a person of the family changes it to `revisada`. What only a pending source says is
  **not a fact of the tree yet**: it goes only to «Notas de investigación», with its citation, and the source to
  `sources`; never to the other frontmatter keys, the biography nor `aliases` (a name variant that turns out wrong is
  just noise). If it differs from what the tree already has, the difference also goes to `research/incoherencias.md`.
  When a person of the family reviews the source, its data move from the notes to the frontmatter, the biography and
  `aliases` (the name variants it documents), and only then can they change what the tree had.
- Online indexes and transcriptions (FamilySearch, archive catalogues, transcribed censuses) are third-party readings,
  not the document: transcribe from the image of the original whenever it can be seen, and note where the index
  differs; a source taken only from an index says so and comes in as `status: indicio`.
- No ID numbers, current addresses nor bank data of living people are copied.
- The family's data (notes, documents, names and dates of the living, answers of relatives) are not sent to services outside
  the tree's own repository and server: no pages, forms, pastes or shares on third-party hosting, even private ones, unless
  the user asks for it. Questions for relatives are given as text for the user to send.
- Archives and institutions are always named in full («National Archives», not «NA»): the family reads the website.
  Acronyms only stay inside call numbers.
- The code (names, comments and internal messages) is in English; what the family reads, in the tree's language and
  only in `scripts/i18n_<language>.py` and `web/src/i18n/<language>.ts`. The data values (`pendiente`, `genealogia`,
  `rama/`…) are compared with constants that contain them.
- Python: 4 spaces; only the standard library or dependencies declared in the `# /// script` block.
- TypeScript (`web/`): 2 spaces, `strict`. Solid components with JSX: the state in signals, the derived values with
  `createMemo`, `<Show>`/`<For>` and the events in the components themselves (the listeners of `window` or `document`,
  with `listen` of `src/events.ts`, which removes them on unmount). No building HTML from text. If the shape of the
  `payload` of `build_site.py` changes, change at the same time `web/src/types.ts` and its check in
  `web/test/contract.ts` (if not, it does not compile or `make html` fails). After touching `web/`: `make test` and
  `make e2e`.

## Engine and data

This repository can be a copy of the public template or share its engine with it. Every file is either:

- **of the engine** (the list is `scripts/template_paths.txt`): code, tests, skills, templates, deploy and these
  guidelines, identical in every tree; they never carry names of the family (fictional examples only);
- **of the family**: `families.yml`, `places.yml`, `TREE.md` and the data folders (`paths`), only in its own
  repository.

Commits of code do not touch data, and commits of data do not touch code, so that code commits can travel between the
tree and the template (cherry-pick). `make check-template` searches the engine's files for the family's names;
`scripts/hooks/pre-push` (installed with `make hooks`) refuses a push to a remote called `github` or `kit` if any commit
in the history of what is pushed touches the family's files, if `check_template.py` finds names in the engine's files or
in the messages of the commits that remote does not have yet, or if a message carries the
«(cherry picked from commit …)» line of `git cherry-pick -x` (the hash of a private commit). So a code commit goes to
the template with `git cherry-pick` without `-x` and its message rewritten in generic English; `TREE.md` may say how
this tree does it.

## Updating the kit

A tree starts as a clone of the public kit (`git clone https://github.com/elboletaire/family-tree-kit <folder>`), with
its remote renamed to `kit` (`git remote rename origin kit`): `kit` only brings updates of the engine, and **nothing is
ever pushed to it** (the `pre-push` hook refuses it). Where the tree itself is kept (only this computer, a private
repository as `origin`, another Git server) is decided in the `start-tree` skill. The engine's files only change
through kit updates or the user's own changes.

When the user asks to **update the kit**:

1. Commit or set aside what is pending, and `git fetch kit`. Show what comes (`git log --oneline HEAD..kit/main`).
2. `git merge kit/main` (or `git pull kit main`). Conflicts can only be in the engine's files the tree changed itself:
   resolve them keeping both intentions, and ask the user when they cannot be combined. The data files never
   conflict, because the kit has none.
3. `make validate` and `make test` (and `make html`, to see the website): a new version may check something the tree
   does not comply with yet; fix the data in a separate commit.
4. Push to `origin`, if the tree has one — never to `kit`.

A tree made with GitHub's "Use this template" button has a history unrelated to the kit's: the first update needs
`git remote add kit https://github.com/elboletaire/family-tree-kit`, `git fetch kit` and
`git merge --allow-unrelated-histories kit/main`, resolving by hand the conflicts of every engine file that changed
since the copy; later updates are normal merges.

## Commits and deployment

Messages with a conventional prefix (`feat:`, `fix:`, `docs:`) and a body that explains why; their language is set
in `TREE.md`. The `pre-push` hook uploads the originals with Git LFS. A push to `main` of the server's remote deploys
and regenerates the website on the server automatically (`deploy/post-receive`); if the leak check fails, it is not
deployed and the previous version stays. With `PUBLIC_SITE=0` (default) the server serves nothing without a session
except its password page; with `PUBLIC_SITE=1` it serves `build/public/` to everyone, and `build/private/` (at
`/private/`) and the originals of the sources folder only with a session (401 without content if not); it receives the
name of that folder in `SOURCES_DIR`: the hook reads it from `paths.sources` with `scripts/config.py`, and by hand it
goes in `.env`.
