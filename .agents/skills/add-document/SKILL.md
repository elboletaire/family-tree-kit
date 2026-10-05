---
name: add-document
description: Add a new document or photo to the tree — certificates, wills, deeds, obituaries, letters, family photos, scans handed over by relatives or found online — by transcribing it, cleaning up photos (crop, perspective, redaction), creating its source note in the sources folder and updating or creating the people it names. Use when the user drops files (Downloads folder, Drive) or shares a document.
---

# Add a document (and the people in it)

Talk to the user in the language they write in, and write questions and the tree's content in the tree's language
(`language` in `families.yml`), not in the language of this skill.

Data folders are named by their role — the people, sources, research and portraits folders — and their names
are in `paths` of `families.yml` (by default `people`, `sources`, `research` and `portraits`). Below, `<sources>/F0xx.md`
means a file in the sources folder (`paths.sources`), and so on.

Every fact in the tree hangs from a source file. This skill turns a document into one, and the document's content
into person data. Schema, date formats, confidence levels and the photo policy are in `AGENTS.md`; read the
"Sources", "Photos" and "Rules" sections before starting, and `TREE.md` if it exists (this tree's own conventions: its
key sources, where its originals come from).

## 1. Look before touching

1. Open every file (images, PDFs page by page). Identify: what kind of document, date, place, issuer, who appears
   and in which role.
2. Decide what may be stored (`AGENTS.md` → "Photos"):
   - Documents are always evidence and are stored — **except** for the ID numbers, current addresses and bank data
     of **living** people: either redact them in the image (step 3) or store only the transcription and say so in
     the source ("no images stored: contains ID numbers of living people"). Only the living are protected: a
     deceased person's own ID card, deed or certificate is stored and transcribed as it is, number and home
     address included; but living people who appear in it (heirs, witnesses, a surviving spouse) are still
     redacted.
   - Photos: no photos where a living person is a recognisable protagonist; deceased people get one portrait plus
     one per life stage at most, and group photos only when everyone identified has died.
   - Identify people only when it is certain (a caption, a name on the back, a document). Doubtful identifications
     go to `<research>/pendientes.md` with the file name, so the family can answer.
3. Check it is new, **before creating any `F0xx`**:
   - `uv run scripts/lookup.py --duplicates` with every clue of the document, one argument each: its date of
     publication or issue (in any form: `1931-04-12`, `12-4-1931` and «12 de abril de 1931» are the same date), its
     address (scheme, «www.», tracking parameters and the final «/» do not matter), its archive id (`idImagen=4711`,
     `path=/libros/77`, a call number) and its file name. It lists every source that already has one of them in its
     `date`, `pages`, `origin`, `files`, title or body. Look at each match: the same notice may have come from the
     shared folder and from a newspaper archive, or be one page of a compilation already in the tree.
   - `uv run scripts/lookup.py --sources` with the names of the people (their cards list their sources and their
     items in `<research>/descartados.md`). A document the family already rejected (`descartados.md`) is not added
     again.
   - If the document is already a source, add only what is new to it (a better copy, a missing page). If it is one
     page of an existing compilation (a series of notices of the same person, the pages of one file), it is cited
     from that compilation: its page goes in the compilation's `pages` and its files in `files`, with its
     transcription in the body; it is not a new source.

## 2. Transcribe

- Create `<sources>/F0xx.md` with the next free number and the full frontmatter of `AGENTS.md`.
  - Trusted by default (no `review` key): originals from the family archive or handed over by relatives.
  - `review: pendiente`: anything found by automated or AI-assisted research (newspaper archives, gazettes, archive
    catalogues, web pages). Only a family member marks it `revisada`.
  - `status: indicio` when it only suggests something (a catalogue entry, a homonym not yet confirmed).
  - `origin`, always (`make validate` requires it): how the document reached the tree, in one line. A shared folder:
    «Carpeta compartida «Papeles de la abuela», subcarpeta «Testamentos», fichero «test1.pdf»». A message: «Foto
    enviada por WhatsApp por su sobrina el 3 de mayo de 2026». A website: «Hemeroteca de El Diario Ficticio, edición
    del 12 de abril de 1931, p. 8, consultada el 2 de octubre de 2026 (https://…)». An archive: the archive in full
    and the call number. In hand: who gave it and when. `origin` is prose: its dates go in long form, in the tree's
    language (`AGENTS.md` → "Dates"); the names of files and folders are quoted as they are. Only what is known (a folder and a file name is a fine origin), and no living
    person's full name when it can be avoided: the origin counts for the public version.
- Transcribe literally: original spelling and language, abbreviations as written, line breaks where they matter,
  `[?]` for doubtful readings, `[…]` for illegible parts. Redacted data is written as `[DNI omitido]`,
  `[domicilio omitido]`.
- `## Personas que aparecen`: each person with the form of the name in the document.
- `## Notas de investigación`: what it proves, what it contradicts, what it suggests looking for next.

## 3. Clean up photographed documents and photos

Users often photograph a photo or a paper with a phone: hands, table, perspective, glare. Store what looks like the
original, not a photo of it. With Python (Pillow, declared in a `# /// script` block or run with
`uv run --with pillow`):

- **Perspective**: find the four corners of the print or sheet and rectify with
  `img.transform((w, h), Image.QUAD, (x0,y0, x1,y1, x2,y2, x3,y3), Image.BICUBIC)` (corners in order top-left,
  bottom-left, bottom-right, top-right). Pick `w, h` from the real aspect ratio of the print.
- **Crop** tight: no fingers, no background, no white strips left by an uneven edge — tighten the corners by a few
  pixels until the border is clean.
- **Redaction**: fill black rectangles with `ImageDraw.rectangle`. Do it on the full-resolution image, then render
  a zoomed preview of each redacted area and check it yourself: boxes are easy to misplace by a line. Iterate until
  the ID numbers and addresses are fully covered and nothing else is.
- Convert to JPEG (quality ~90), keep the original resolution; convert BMP to PNG losslessly if it must stay
  lossless. Never keep an unredacted copy in the working tree: the website and the sources served with a session
  are built from it.
- **Git history** of a private repository may keep the unredacted version: when redacting a file that was already
  committed, commit the redacted one over it and do not rewrite history, so that the original can be restored
  (`git checkout <sha> -- <file>`) once the person has died. A new document is redacted before its first commit;
  its unredacted original stays where it came from (the shared folder, the relative who sent it). If the repository
  is or becomes public, its history must not hold unredacted copies.
- Store files in `<sources>/F0xx/` (Git LFS) with descriptive names, a date in them as YYYY-MM-DD
  (`El Diario Ficticio 1931-04-12 p8.jpg`), and list them in `files`. Originals in the
  sources folder are never edited afterwards.
- **Newspaper notices and other pages taken from an online archive**: read and transcribe from the page image, never
  from the archive's OCR alone (the OCR mixes columns and misreads names). **Always store both**: the whole page the
  notice is on and a colour crop of the notice. The crop is what the website shows and what a reader reads; the page is
  the evidence of where it was printed (the masthead, the date, the neighbouring notices) and lets anyone crop it again
  or read what was next to it. A source with only the crop, or only the page, is unfinished. When the portal lets you
  download the whole issue, keep its other pages too: other people of the tree may turn up in the same issue, and
  searching a local copy is easier than searching online. The same goes for a register or an index page (a civil
  registry book, a printed list): the page and a crop of the entry. **One crop per notice, readable on its own**: a notice
  often breaks across columns (the heading — a town's name, a party, an «obituaries» section header — at the foot of
  one column and its text at the top of the next, or a long list continuing in the next column). Crop each piece and
  stack them top to bottom, left-aligned, into a single image; never store a piece that only holds a heading, which on
  the website is a thumbnail that says nothing. Several numbered crops of the same page are only for notices that are
  distinct and make sense each alone. Trim from each piece whatever belongs to the neighbouring columns (a photo's
  edge, another notice's lines). A whole issue is often a heavy PDF (tens of MB), which is not stored as it is; keep
  each page in colour as JPEG at about 200 dpi and quality ~75 (2-3 MB per broadsheet page: the paper and its tone as
  the archive scanned them, and enough to derive any other copy), named by page (`…-p1.jpg`), and put the link to the
  original in `origin` and in the transcription. No black-and-white copies for OCR are stored: they are derived from
  the page when needed (median filter, autocontrast, a threshold around 140) and kept in the scratch folder. If no
  image can be had, say so in `origin` and add an item to `pendientes.md` to get it.
- A portrait for a person's `photo` is a derived crop in `<portraits>/<slug>.jpg`, documented with a row in
  `<portraits>/README.md` (source and crop box).

## 4. Update the people

- For each person named: add the source to `sources`, the facts (of a trusted source; see the next point) to the
  frontmatter and the biography, each cited inline `([F0xx](../<sources>/F0xx.md))`. The biography tells the life, not the research: where the document came
  from, who identified whom and any correction go to `## Notas de investigación` (`AGENTS.md` → "People", Body).
- A document outranks the family tree and memory — once it is trusted. What only a source with `review: pendiente`
  says goes only to `## Notas de investigación` (never to the other frontmatter keys, the biography nor `aliases`),
  and its differences also to `<research>/incoherencias.md`, until a family member reviews it (`AGENTS.md` →
  "Rules"). If it contradicts another document, keep the one closest to the event, explain in the notes and add an
  item to `<research>/incoherencias.md`, under the family and branch of the people involved.
- New people: every relative of the family the document names gets a file, living or dead (being alive only keeps
  photos, ID numbers, addresses and the like out; `AGENTS.md` → "People", who gets a note); people with no link to
  the family (notaries, witnesses, officials) stay in the source note. Create them with what the document says; parents from a certificate or will are `proven`, from
  anything weaker `probable`. Speculative links never go in the frontmatter — only in the notes.
- Carry every new or corrected fact to all the notes that depend on it (`AGENTS.md` → "Rules", a new fact is carried
  everywhere): `lookup.py <slug> --links` for each person touched, and `--text` with any value the document corrects.
- Sources that mention several people must be linked from all of them (a list of candidates names two relatives:
  both get the source).
- Remove from `pendientes.md` what the document answers; add what it opens: every question it raises (an
  unidentified person, a doubtful reading of a name or date, a gap, something to ask the family) is written there
  now, not only in the report to the user.

When importers ran as subagents, review their work before closing: the right pages in the right source, readable
crops, the transcription against the image, `files` complete, the people updated as the rules say.

## 5. Close

`make validate` (0 errors; it also checks that every file in `<sources>/F0xx/` is listed), commit, and tell the user
in a few lines what the document added, what was redacted or left out and why, and which questions it raises for
the family — each of them already in `pendientes.md` or `incoherencias.md`.

Then **offer** (do not start) the two to four things the new data make possible, each in one line and concrete,
and wait for the answer. Many users do not know what else the tree and the agent can do, so these offers are how
they find out:

- a search with the new data (`genealogy-research`): a death date and town open the obituary in that town's press, a
  birthplace the parish books, an occupation the official gazettes — say what would be searched and where;
- questions for a relative about what the document leaves open (`family-interview`), ready to send;
- other documents the family may keep and that would settle a doubt (the other half of a deed, the back of a photo);
- reviewing the pending sources of the same people, if there are any.

When several searches are independent, say that they can run in parallel as subagents (in clients that have them)
while the user goes on with something else, and roughly how long they take.
