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
3. Check it is new: grep the sources folder for the date, the names and the file name. The same obituary may have come
   from the Drive and from a newspaper archive.

## 2. Transcribe

- Create `<sources>/F0xx.md` with the next free number and the full frontmatter of `AGENTS.md`.
  - Trusted by default (no `review` key): originals from the family archive or handed over by relatives.
  - `review: pendiente`: anything found by automated or AI-assisted research (newspaper archives, gazettes, archive
    catalogues, web pages). Only a family member marks it `revisada`.
  - `status: indicio` when it only suggests something (a catalogue entry, a homonym not yet confirmed).
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
  lossless. Never keep an unredacted copy anywhere in the repo, including git history.
- Store files in `<sources>/F0xx/` (Git LFS) with descriptive names, and list them in `files`. Originals in the
  sources folder are never edited afterwards.
- A portrait for a person's `photo` is a derived crop in `<portraits>/<slug>.jpg`, documented with a row in
  `<portraits>/README.md` (source and crop box).

## 4. Update the people

- For each person named: add the source to `sources`, the facts to the frontmatter and the biography, each cited
  inline `([F0xx](../<sources>/F0xx.md))`.
- A document outranks the family tree and memory. If it contradicts another document, keep the one closest to the
  event, explain in the notes and add an item to `<research>/incoherencias.md`, under the family and branch of
  the people involved.
- New people: create them with what the document says; parents from a certificate or will are `proven`, from
  anything weaker `probable`. Speculative links never go in the frontmatter — only in the notes.
- Sources that mention several people must be linked from all of them (a list of candidates names two relatives:
  both get the source).
- Remove from `pendientes.md` what the document answers; add what it opens.

## 5. Close

`make validate` (0 errors; it also checks that every file in `<sources>/F0xx/` is listed), commit, and tell the user
in a few lines what the document added, what was redacted or left out and why, and which questions it raises for
the family.
