# Resources in France

For families with a branch that crossed the border (Republican exile, economic emigration, cross-border work) or that
lived in France. Spanish sources are in `resources-spain.md`; techniques in `techniques.md`. Institutions are named in
full. Each entry says whether it was checked or only reported by another tree: a reported one is a lead to try, not a
promise that it works.

## Deaths

**INSEE — Fichier des personnes décédées (since 1970)**, searched through `deces.matchid.io` — name, sex, birth date and
place (foreign countries included, which shows where an emigrant was born), death date, age and place, and the civil
registry certificate number. *Checked:* the site has a JSON API that answers plain curl, with no login:
`https://deces.matchid.io/deces/api/v1/search?q=<given name> <surname>&size=<n>`; each entry of `response.persons`
has `name`, `birth` (`date` as `YYYYMMDD`, `location`) and `death` (`date`, `age`, `location`, `certificateId`). Try
the name with and without the second surname and without accents. Deceased people only: do not use it for the
living. The certificate number identifies the record to ask the town hall (mairie) for.

## Censuses and registers

**Archives départementales** — one per département; some put registers and household censuses (recensements de
population) online. *Reported, not checked:* the Ardennes, the Aude, the Calvados and the Somme have household
censuses online (several years between 1926 and 1946 for some communes). Read a census household by household: it gives birthplace and occupation
for each member.

## Newspapers and directories

**Gallica (Bibliothèque nationale de France)** — digitised press and annuaires. *Reported, not checked:* the
Annuaire-guide de l'Aude (a directory of a département's tradespeople and officials).

## Courts

Judgments of French courts (for example a civil tribunal's) turn up in family archives: record the court in full, the
date and the number, and treat them as original documents.
