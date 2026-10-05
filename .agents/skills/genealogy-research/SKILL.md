---
name: genealogy-research
description: Research ancestors and relatives online — newspaper archives and obituaries, official gazettes, archive catalogues, church-record indexes, military and political sources, social media — and record the findings as pending sources without polluting the tree. Use when the user asks to find more about someone, fill a gap (death date, parents, marriage, career), check a lead, or "search sites like …". Strongest coverage for Spain (Catalonia, Asturias, Castile, the Basque Country), with references for France and Argentina and techniques that work for any country.
---

# Genealogy research

Talk to the user in the language they write in, and write the tree's content in the tree's language (`language` in
`families.yml`), not in the language of this skill.

Data folders are named by their role — the people, sources, research and portraits folders — and their names
are in `paths` of `families.yml` (by default `people`, `sources`, `research` and `portraits`). Below, `<sources>/F0xx.md`
means a file in the sources folder (`paths.sources`), and so on.

Schema and rules are in `AGENTS.md` (above all "Sources" and "Rules": every finding comes in pending review), and this
tree's own conventions in `TREE.md` if it exists. Start from what the tree already has:
`uv run scripts/lookup.py <person>` gives their facts, family, sources and open and discarded items in one call.

Good research here is persistence plus method: most useful archives are free but awkward (JavaScript apps, anti-bot
challenges, OCR full of errors, search forms that silently ignore parameters). A less determined agent stops at the
first 403; the answers are usually one technique further. Equally, an eager agent attaches the wrong person — homonyms
are the main risk. This skill covers both.

Reference files (read the one you need, not all):

- `references/resources-spain.md` — where to look in Spain, by record type and region, with URL patterns.
- `references/resources-france.md` — where to look in France (deaths since 1970, censuses, departmental archives), for
  branches that emigrated or went into exile there. Kept apart from Spain on purpose.
- `references/resources-andorra.md` — the national archive's catalogue and where the parish books are, for branches
  from the Andorran valleys.
- `references/resources-argentina.md` — where to look in Argentina (arrivals at the port of Buenos Aires, national archive,
  FamilySearch), for branches that emigrated there.
- `references/techniques.md` — how to get past JS apps, challenges and broken search forms; OCR and download tricks;
  sites that are blocked and what to do instead.
- `references/identification.md` — homonyms, weak vs strong identifications, conflicting dates, error patterns seen
  in real sources.

## 1. Frame the question

Start from the tree, not from the web:

1. Read the person files involved, their sources, and the open items in `<research>/pendientes.md` and
   `<research>/incoherencias.md`. Read `<research>/descartados.md` too: what the family already rejected (homonyms,
   records of someone else) is not brought back.
2. Write down the concrete questions (when did X die, who were Y's parents, what was Z's job in 1930) and the
   **anchors** that will identify the right person: full name with every surname and spelling variant, approximate
   birth year, places lived, spouse, children, occupation.
3. Pick resources by question type and period (table below) and by region (`references/resources-spain.md`).

| Question | First places to look |
|---|---|
| Death date, spouse, children, in-laws (20th–21st c.) | Obituaries (esquelas) in newspaper archives; anniversary notices give exact birth dates |
| Birth/baptism, parents, grandparents (before ~1925) | Diocesan archive indexes; civil registry certificates; provincial gazettes that copy birth records |
| Career of a civil servant, teacher, military officer | State and provincial gazettes (appointments, seniority lists with birth dates, competitions) |
| Civil War, repression, political office | Combatant indexes, national archive portals (political-social index cards, Causa General), victims portals, local press election results |
| Young men 18–21 | Draft (quintos, reemplazo) lists in gazettes and local press: birth date and place |
| Landowners, businesses | Expropriation edicts in gazettes, company registers, business directories, invoices in the family archive |
| Photos and faces | Local archive photographic fonds, social media posts of local history groups, cemetery photo indexes |
| Living relatives' public roles | Council websites, candidate lists — but see privacy |

## 2. Work in a sandbox

- Work in a scratch folder outside the repository (`/tmp/research/<topic>/`). Download pages, PDFs and images there
  with descriptive names (`YYYY-MM-DD_publication_topic.pdf`). Do not touch the tree until findings are graded.
- For several independent questions, run one research subagent per branch or question in parallel. Give each: the
  anchors, the questions, the resources to try, the sandbox path, and the rule that it must not edit the repository.
- Keep scripts: a working scraper for a site is worth reusing in the next session. Keep cookie jars per site, set
  timeouts (`curl --max-time`), and run long scans in the background.

## 3. Search thoroughly

- Search the exact phrase and every variant: accents, local-language forms (Jordi/Jorge, Pere/Pedro), OCR-prone
  splits and substitutions (use regexes like `rodr.gu.z` for Rodríguez), a missing second surname, married names ("X de Y").
- For rare surnames, search the surname alone and filter; harvesting every hit with its date and snippet and then
  filtering locally beats reading pages of results.
- For an event with a known date (a death), review the issues of the following days page by page — obituaries are
  often image-only and invisible to full-text search.
- Always read the notice on the page image, not only the OCR, and save both the whole page and a crop of the notice
  (the `add-document` skill says how). A finding recorded from
  the OCR text alone is not finished: look for the image or the issue's PDF first (viewers often hide a download link
  in the page source; see `references/techniques.md`), and store it as the `add-document` skill says.
- Follow the family network: an obituary lists spouse, children and their spouses, grandchildren — it tells you who
  belongs to which branch and gives new names to search.
- Record what you searched without results, so nobody repeats it.

## 4. Grade every finding

For each finding, report: literal quote, URL or archive reference (with the id needed to reopen it), downloaded file,
and a grade:

- **confirms** — matches several anchors and nothing contradicts it;
- **strong lead** — rare name + consistent age/place/occupation, but no document ties it to the family;
- **lead** — plausible, one anchor;
- **discarded** — homonym or contradiction (say why).

See `references/identification.md`. A match on name alone is never enough, however rare the name looks.

## 5. Record in the tree

Only after grading, and following the `add-document` skill:

- Each document becomes `<sources>/F0xx.md`, with `origin` stating that it came from automated research, where
  (institution in full, URL, reference) and when. **Always `review: pendiente`** — only a family member sets
  `revisada`. `status: indicio` for leads and uncertain readings; `pendiente` when only a catalogue entry exists and
  the document must be requested.
- Transcribe literally from the image of the original whenever it can be seen; mark doubtful readings `[?]`. An
  online index or transcription (FamilySearch, a catalogue, a transcribed census) is someone else's reading: note
  where it differs from the image, and if there is no image, say the source comes only from the index
  (`status: indicio`).
- What a pending source says goes only to `## Notas de investigación`, cited: not to the other frontmatter keys,
  the biography nor `aliases`, not even to fill a gap. Where it differs from what the tree already has, record it
  also in `<research>/incoherencias.md`. The data move to the frontmatter, the biography and `aliases` only after a
  family member reviews the source (`AGENTS.md` → "Rules").
- Link the source from every person it names. In the biography, only the facts (cited); how the record was found and
  matched goes to `## Notas de investigación` (`AGENTS.md` → "People", Body).
- Leads that are not evidence (possible relatives, weak matches) go to `## Notas de investigación` and
  `<research>/pendientes.md`, never to frontmatter fields. Every question a search opens, and a search that found
  nothing (with the queries tried), is written in `pendientes.md`.
- Contradictions with other documents go to `<research>/incoherencias.md` (see `references/identification.md`).
- AI output (including your own summaries) is never a source. A claim from an AI conversation can be a lead to check.
- If the family later rejects a source, delete it and every datum that depends on it, and record it in
  `<research>/descartados.md` (`AGENTS.md` → "Rules"). Only what a family member has rejected goes there: that file is
  not shown on the website, so the family would never see a rejection decided by research. A finding you rule out
  yourself (a homonym excluded by its dates) goes to `<research>/pendientes.md` as a possible homonym to confirm
  (`- **¿Homónimo? …** — …`, in the tree's language), with the reference that would bring it back and why you think it is
  not the person, so the next search does not pick it up again; it moves to `descartados.md` once a family member
  confirms it.

## 6. Report and next steps

Research opens more research. What the user asked for is done in full; anything beyond it is **asked, not done**:
a finding that points to other people (siblings, a second marriage, the family of an in-law), to another country or
archive, or to a long job (a whole run of a newspaper, an archive request by email, a paid service) is offered with
what it would take, and started only if the user says so.

End with a short report for the user: what was found and its grade, what was not found, and the next steps that
need a human: archive requests (which archive, which book/folio/reference, by email or form), certificates to order
from the civil registry, and questions for relatives (prepare them with the `family-interview` skill). Then the **offers**, each in one line:
the searches the findings open (who, what, where), which of them could run in parallel as subagents while the user
does something else, and reviewing the new pending sources together, one by one, so that their facts can enter the
tree.

## Privacy

- Being alive is not a reason to leave a relative without a person file (`AGENTS.md` → "People", who gets a note):
  what keeps a person found in the press out of the frontmatter is that the source is pending review, as for the
  dead. Until a family member reviews it, they stay in the notes; once their link to the family is confirmed, they
  get their file with name, dates and biography. People with no link to the family never get one.
- Never store ID numbers, current addresses or bank data of living people; no photos of living people.
- Do not publish or send family data to third-party services beyond the search queries themselves; never use
  credentials or session cookies the user offers for social networks — find a public route instead.
- Restricted archive images may be kept for family consultation only; say so in the source.
