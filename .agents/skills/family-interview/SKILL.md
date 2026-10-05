---
name: family-interview
description: Prepare a numbered question list for a relative (phone call, visit, message) from the open items of a family branch, then turn their answers into an oral-testimony source and update people, conflicts and pending items. Use when the user says a relative is available, on the phone, or has answered questions.
---

# Interview a relative

Talk to the user in the language they write in, and write questions and the tree's content in the tree's language
(`language` in `families.yml`), not in the language of this skill.

Data folders are named by their role — the people, sources, research and portraits folders — and their names
are in `paths` of `families.yml` (by default `people`, `sources`, `research` and `portraits`). Below, `<sources>/F0xx.md`
means a file in the sources folder (`paths.sources`), and so on.

Living relatives are the most perishable source in the tree. Interviews usually happen with little notice ("I have
my aunt on the phone now"), so preparing the questions must be fast, and recording the answers must be faithful.

Schema and rules are in `AGENTS.md` (sources, dates, confidence, privacy), and this tree's own conventions in
`TREE.md` if it exists. This skill is the workflow.

## 1. Prepare the questions (fast)

1. Identify the branch: the relative, and whose parents/grandparents/siblings they can speak about.
2. Collect open items for those people (`uv run scripts/lookup.py rama/<key>` lists the branch's people and items,
   and `uv run scripts/lookup.py --items <slug> <slug>...` gives each person's card with their items in full):
   - `<research>/pendientes.md` and `<research>/incoherencias.md` under that family and branch;
   - person files of the branch: missing `born`/`died`/places, doubtful dates (`¿…?`, `c.`), `nombre-nn` or
     `nn-apellido` slugs, missing parents, `## Notas de investigación`;
   - pending sources (`review: pendiente`) that name this family — a relative can confirm or reject them.
3. Write a **numbered** list, grouped by person, most important first. Each question closed and concrete:
   - "When and where was X born? (we have 'around 1923', from Y's memory)"
   - "Two sources disagree: born in A (document) or B (family)? Which is right?"
   - "Is the X in this 1958 newspaper note the same person? He was from Z."
   Mention what is already known so the relative can correct it. Keep it short enough to read aloud (10–15 items);
   put the rest in a second round.
4. Ask for spellings of names and places (accents, local forms), and for surnames of in-laws and grandparents,
   which are the usual gaps.
5. Ask about documents and photos they keep (certificates, funeral cards, family books, photos with names on the
   back). The papers families usually still have, worth naming one by one: the *libro de familia*, military service
   booklets (cartillas militares, with the recruitment office, *caja de recluta*, and its number), social security and
   pension papers, municipal certificates and court judgments, newspaper clippings, and the funeral cards.
6. Tell them, at the top of the list, how the answers are used: only what they know or want to say; doubts are
   recorded as doubts; no addresses, phones or ID numbers; they can ask to leave someone or something out; the living
   are only seen with the password. Do **not** ask them whether they agree to appear in the tree: they cannot consent
   for the other people the questions are about, a «no» has no defined effect (the person is already in the tree from
   other sources), and someone who answers a family interview already knows what it is for. If they object by their
   own account, follow the Privacy section.

Do not ask the family to confirm trivial things (a living cousin's public profile, obvious identities): decide
yourself and move on.

## 2. Record the answers

Answers come back numbered, often in fragments, sometimes corrected minutes later.

1. Create a new source `<sources>/F0xx.md` (next free number): type "oral testimony", `category: genealogia`,
   `date` today, `issuer` the relative (and who relayed it), `origin` how it was obtained, always (`make validate`
   requires it): who answered and who relayed it, the channel (phone call, visit, Telegram or WhatsApp messages, a
   form, an email), the date, and the language if it was translated — e.g. «Respuestas por WhatsApp de su tía,
   transmitidas por el usuario el 4 de octubre de 2026, en catalán; traducidas al importarlas» (dates in long
   form: `origin` is prose). A source given by the family carries **no** `review` key (it is trusted by default).
2. `## Datos`: one bullet per answer, keeping the relative's wording, place names and spellings. Record doubt as
   doubt ("she thinks 1970 or 1971").
3. Corrections arriving later the same day go in a `## Correcciones del mismo día` section (and the facts are
   updated) — do not silently rewrite the first answers. Corrections on another day are a new source.
4. `## Notas de investigación`: what the testimony confirms, contradicts or leaves open, with links to the other
   sources.

## 3. Apply them to the tree

- Update each person: dates in the formats of `AGENTS.md` (`"¿1970-05-29?"` when doubtful, `"c. 1947"` when
  approximate), places, parents, spouses (both sides, identical `marriages`), `sources` and inline citations in the
  biography. The biography states the facts plainly; who said what, and a fact the relative corrected, go to
  `## Notas de investigación` (`AGENTS.md` → "People", Body).
- Create new people named in the answers (great-grandparents, siblings, in-laws, cousins, the living too: name,
  dates, places and what they told) with what is known;
  `parents_confidence: probable` when only oral testimony supports the relation.
- Carry every new or corrected fact to all the notes that depend on it (`AGENTS.md` → "Rules", a new fact is carried
  everywhere): `lookup.py <slug> --links` for each person touched, and `--text` with any value the answer corrects.
- Rename slugs when a surname becomes known or its spelling is corrected; update every `"[[slug]]"` and markdown
  link to it (grep the whole repo, including `families.yml`, `<portraits>/README.md` and the research folder).
- A document outranks memory: if the answer contradicts a document, keep the document's value, explain it in the
  notes and add an item to `incoherencias.md`. If a document is itself unclear (a date misread by OCR), the
  testimony can settle it — say so.
- Remove resolved items from `incoherencias.md` and answered questions from `pendientes.md`, but only after the answer
  is in the people's notes (the settled fact in the frontmatter and biography, a rejection in `descartados.md`); add the new
  ones that came up, all of them, before telling the user: an answer that opens a question (a name without surnames,
  «a cousin», an unsure date) leaves it written there.
- Photos they send: `add-document` skill.

## 4. Close

`make validate` (0 errors), commit with a message saying who answered what, and tell the user in two or three lines
what changed and what is still open for the next call. Then **offer** (do not start) what the answers make
possible, and wait: a search with the new names, dates and places (`genealogy-research`: say what and where, and that
independent searches can run in parallel as subagents while the user does something else); the next questions,
for this relative or another who would know (`family-interview`); documents or photos the relative mentioned that
could be asked for (`add-document`).

## Privacy

Relatives often say more than the tree should keep. Do not record current addresses, ID numbers, phone numbers,
health details of living people, or anything they ask to keep out. Do not record where a living relative lives now
unless they agree.
