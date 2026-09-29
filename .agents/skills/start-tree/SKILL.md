---
name: start-tree
description: Bootstrap a new family tree from nothing — interview the user about themselves, parents and grandparents, create the first person files and the families config, and get `make validate` and the website working. Use when there is no families.yml, the people folder is empty, or the user says they are starting their tree.
---

# Start a family tree from zero

The user has nothing written down yet. Your job is to turn what they remember into the first dozen person files,
with every fact traceable to a source, and leave them with a working website and a list of what to look for next.

Read `AGENTS.md` first: it is the contract for file names, frontmatter keys, date formats, sources and the families
config. This skill is the workflow; `AGENTS.md` is the schema. When they disagree, `AGENTS.md` wins. What is specific
to this tree (not to every tree made from the template) goes in `TREE.md`, which this skill creates (step 6).

Data folders are named by their role — the people, sources, research and portraits folders — and their names are
in `paths` of `families.yml`. Below, `<sources>/F0xx.md` means a file in the sources folder (`paths.sources`), and so
on.

## 0. Language and the families config

Before anything else, ask (in the language the user wrote in) **which language the tree is written in**:
biographies, transcription notes, research documents and the website. Spanish (`es`) is the default and, for now, the
only language with texts for the scripts and the website (`scripts/i18n_<language>.py`, `web/src/i18n/<language>.ts`);
another one needs those two files translated first. Documents are always transcribed in their original language
regardless. Talk to the user in the language they write in.

Then create `families.yml` from `families.example.yml` (copy it; do not edit the example):

- `language`: the answer above (`es` by default).
- `paths`: keep the defaults (`people`, `sources`, `research`, `portraits`) unless the user wants other folder names.
  Create those folders.
- `main`: the user's slug, once you know their full name (step 2).
- Replace the fictional family, branches and groups of the example with the real ones as you learn them (step 5).

Every later session and skill reads the language from `families.yml`, so it is never asked again. The skills
themselves are in English; that never decides the language of the conversation or the content.

## 1. Where to keep the tree

Ask early, in plain words (the user may not know what git or GitHub are), where the tree should be kept. It can be
decided later: the tree works on this computer either way.

- **Only on this computer.** Fine to start with. Warn that it then needs a backup: a copy of the folder in a cloud
  drive, on an external disk… A tree lost with a laptop is years of work.
- **In a private GitHub repository.** Always **private**, never public: the tree holds names, dates and places of
  living people and scans of the family's documents (the website has its own public version, without the living).
  With the GitHub CLI: `gh repo create <name> --private --source . --push`; without it, the user creates an empty
  private repository on the web and you add it with `git remote add origin <url>` and `git push -u origin main`.
- **Another Git server they already have** (their own server, a NAS, GitLab…): `git remote add origin <url>` and push.

The remote called `kit` is the public kit the tree was cloned from: it only brings updates of the engine ("Updating
the kit" in `AGENTS.md`). **Never push to `kit`**, and never make it the tree's `origin`. If the folder still has the
kit as `origin` (it was cloned without renaming it), rename it first: `git remote rename origin kit`. Install the
`pre-push` hook (`make hooks`): among other checks, it refuses a push of the tree to `kit`.

If the tree was made with GitHub's "Use this template" button instead of a clone, its history is unrelated to the
kit's: there is no `kit` remote, and the first update of the kit needs `git remote add kit
https://github.com/elboletaire/family-tree-kit` and `git merge --allow-unrelated-histories kit/main` (with conflicts
to resolve by hand, once); later updates are normal merges. Say so, so it is not a surprise.

Creating the remote and the first push can wait until the first commit of the tree (step 7). Note the answer in
`TREE.md` (step 6): where the tree is kept and where its backups are.

## 2. Ask before writing

Use short rounds of questions (AskUserQuestion when available, 2–4 questions per round). Never ask for everything at
once. Go generation by generation, starting with the user:

1. **The user**: full name as it appears on their ID (all surnames, accents included), sex, birth date and place.
   Whether they want their own data in the tree at all.
2. **Parents**: full names, birth and death dates and places (approximate is fine: "around 1950", "in the 60s"),
   marriage date and place, whether they are alive, other children (the user's siblings, half-siblings).
3. **Grandparents** (four of them), then great-grandparents: same questions. Expect gaps; a first name alone is
   useful ("my grandmother's mother was called Rosa").
4. **What documents exist at home**: family books, certificates, wills, deeds, letters, photos with writing on the
   back, funeral cards, obituaries, a relative's handwritten tree. Each will become a source later
   (`add-document` skill).
5. **Who else knows things**: the oldest living relatives. They are the most urgent source (`family-interview`
   skill).
6. **Naming**: the naming system (one or two surnames, maiden names, patronymics). Slugs follow the surnames the
   family actually uses.

Record uncertainty exactly as said: "born around 1923" → `"c. 1923"`; "I think the 8th of December" →
`"¿1923-12-08?"`; unknown → omit the key or `"?"`. Never round a guess into a firm date.

## 3. The first source: the user's own testimony

Before creating any person, create `<sources>/F001.md` for the conversation itself: type "oral testimony", date
today, issuer the user, and a `## Datos` list with what they said, in their words. Every person you create cites it
in `sources`, and every fact in the biography cites it inline. Later documents will confirm or correct it; the
testimony stays as the record of what was believed.

The user's testimony about their **own** generation and their parents' is strong. What they say about
great-grandparents is family tradition: use `parents_confidence: probable`.

## 4. Create the people

- One file per person, slug from the full name (see `AGENTS.md`: lowercase, no accents, hyphens; `nombre-nn` when
  surnames are unknown, `nn-apellido` when the given name is unknown).
- Only `father`, `mother` and `spouses` link people. Children are never written: they are derived.
- Spouses and `marriages` must be identical on both files.
- `living: true` for the living. Do not store current addresses, ID numbers or phone numbers of anyone alive.
- Siblings whose parents are not in the tree yet go in `siblings`; once the parents exist, remove it.
- Body: `# Full name`, `## Biografía` (short, every fact with its source link), `## Notas de investigación` (what is
  unknown and which document would answer it).

## 5. The families config

Fill in the rest of `families.yml` (see "Families and branches" in `AGENTS.md`), replacing the example's fictional
family:

- `main`: the user's slug — the website opens through their eyes.
- `families`: usually one per side the user cares about (e.g. the father's family and the mother's family), one
  marked `default: true`.
- `branches`: one per surname line with a known founder (the oldest ancestor of that line in the tree), with a
  distinct colour. Add `rama/<key>` tags to everyone who descends from each founder.
- `groups`: how branches are grouped in the review report.

Also create `<research>/incoherencias.md` and `<research>/pendientes.md` with one `##` per family `title`
(exactly as in the config), a `###` per branch, and a `## General`.

## 6. TREE.md: this tree's conventions

Create `TREE.md` at the root, in the tree's language: what makes this tree different from any other made from the
template. `AGENTS.md` stays as it is (it is shared with the template); every later session reads both. Write only
what you know now, and say what is still unknown:

- A short description of the tree: whose it is, which families and branches, where it comes from.
- The content language and, if they are not the defaults, the data folders (`paths`).
- The family's own sources in the hierarchy of `AGENTS.md` ("Rules"): which compiled trees exist (a relative's
  spreadsheet, a handwritten tree) and their source numbers once they are added.
- Where the originals are (a shared folder, boxes at a relative's home) and, for a shared folder, how to reach it for
  `scripts/drive_diff.py`; where the full photo albums are kept.
- The language of the commit messages (ask; by default, the language the user writes in).
- Where the tree is kept (step 1): only on this computer and where its backups go, or its `origin` remote.

## 7. Check and show

1. `make validate` — must end with 0 errors. Fix everything it reports before continuing.
2. `make html` and open `build/web/index.html` with the user: the tree should show their parents and grandparents.
3. Commit (message style in `AGENTS.md` and `TREE.md`) and, if the tree has an `origin` (step 1), push to it — never
   to `kit`.

## 8. Leave a research plan

Write the gaps into `<research>/pendientes.md`, most urgent first:

- Questions only living relatives can answer (who to ask, what to ask) — these expire.
- Documents the family probably has (marriage certificate of the parents, grandparents' funeral cards).
- Civil and church records to request, with the place and approximate year needed.

Then suggest the next step: an interview with the oldest relative (`family-interview`), or searching online for the
grandparents (`genealogy-research`).

## Do not

- Invent or "complete" names, dates or places — a gap is a pending item, not a guess.
- Use AI-generated text as a source.
- Ask the user to confirm trivia they obviously know (their own siblings, their cousin's personal page).
- Put real people's names in anything outside the data folders (code, skills, templates).
- Push to the `kit` remote, or make the tree's repository public.
