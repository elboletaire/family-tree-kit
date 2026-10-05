# Identification, homonyms and conflicting data

The most damaging research error is attaching a record to the wrong person: it spreads to parents, dates and branches
and is hard to undo. Every finding needs a reason why it is *this* person.

## Anchors and grades

Collect anchors before searching: all surnames and variants, approximate birth year, places, spouse, children,
occupation. Then grade:

- **confirms**: two or more independent anchors match (name + age + place, or name + spouse) and nothing contradicts.
- **strong lead**: rare surname combination plus a consistent age, place or occupation, but no link to a known
  relative. Record with `status: indicio`.
- **lead**: name only, or a common name with one matching detail. Notes or `pendientes.md` only.
- **discarded**: an anchor contradicts (wrong age, other parents, other spouse, died while the person was alive). Write
  down why, so nobody attaches it later: as a possible homonym to confirm in `pendientes.md`, not in `descartados.md`,
  which only holds what a family member rejected (see the skill, section 5).

To tell how rare a surname really is, the INE's «Apellidos y nombres más frecuentes» tool (`ine.es/apellidos`) gives
the number of people with it and, reported by other trees, its distribution by province and municipality of birth
(the page is reachable; the municipal breakdown was not checked). A surname held by a few hundred people, all from one
comarca, makes a match on name plus place a much stronger lead than a common one.

A rare-looking name is not proof: in small regions the same full name repeats across cousins and generations
(grandfather and grandson, uncle and nephew). Typical traps seen in real research:

- A newspaper report of a death under exactly the same full name as a relative who, the family knew, died decades
  later — a different man from the same valley. The agent held it back until the family answered, and the family
  confirmed it was a homonym; the source was then deleted.
- People with the same name and first surname but a different second surname, from the next town.
- An age in an obituary that rules out an otherwise perfect match.
- A local press article naming the right surname in another branch of the same family.
- A search with 60+ hits for a common name: all homonyms. Narrow by place and period before reading.

An obituary also checks a compiled family tree: its full list of siblings (the dead ones marked with ✟) confirms that
each child the tree lists really existed. A «child» in a handwritten tree who is missing from every sibling's obituary
may turn out to be an in-law (a son- or daughter-in-law written in among the children).

When in doubt, do not attach: turn it into a question for the relatives (`family-interview` skill), with the date,
place and wording of the record so they can recognise it.

## Conflicting data

- A document beats the family tree and memory; the family's testimony about their own generation beats distant
  secondary sources.
- Between documents, prefer the one closest to the event: a death certificate over an obituary, a baptism over an
  age stated decades later, a civil birth record over a remembered birthplace.
- When only family testimony and an official list disagree (e.g. a draft list vs the family's date), keep the
  family's date until the certificate arrives.
- Never choose silently: explain the choice in the person's `## Notas de investigación` and add an item to
  `incoherencias.md` of the research folder (`paths.research`); once settled, write the
  settled fact in the person (frontmatter and biography, cited) and the choice in the notes, and only then remove the item.
- Label inferences as such (a pension transferred "from the day after" a death dates the death; an age in an obituary
  gives a two-year birth range).

## Error patterns in sources

- OCR: digits misread in years, surnames split or merged, one surname read as another; false positives in full-text
  search.
- Printing: misprinted names (a male form for a female given name) corrected by a later notice, wrong words in titles, impossible
  dates on index cards.
- Newspapers confuse similar place names (a village with a nearby town).
- Official lists keep people who had already died.
- Volunteer indexes (cemetery sites, genealogy indexes) transcribe dates and surnames badly: the stone or the
  certificate wins.
- Spelling of surnames drifts between languages and scribes (Catalan/Castilian forms, accents, `-ó`/`-ol`/`-yó`
  endings): record the documented form in `aliases`, keep the family's form in the slug.
