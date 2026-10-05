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

**Archives départementales des Pyrénées-Orientales** (`archives.cd66.fr/mdr/index.php/rechercheTheme`, portal
`ledepartement66.fr/lesarchivesenligne/`; *checked*, free, no login; reported to be blocked from outside France at
times: a VPN) — for the French Cerdagne and the Roussillon, and for families on both sides of the border: parish
registers 1516–1792 and civil registers 1793–1902 by commune, military recruitment registers by class, household
censuses, mortgage registers 1799–1955, the Napoleonic cadastre, the tables of deaths, successions and absences
1704–1968 by registration office (useful to date a death and find an inheritance), and a selection of files on the
refugees and internment camps of 1939–1942. Each theme is `/mdr/index.php/rechercheTheme/requeteConstructor/<n>/1/R/0/0`
(1 civil registers, 2 military, 3 censuses, 4 mortgages, 5 cadastre, 6 death tables, 13 refugees and camps); browse by
commune and register into the image viewer — no name index for the civil registers. The death and succession tables
are by registration office and by letter (columns: surname, given names, occupation, age, domicile, date of death,
marital status, spouse): read the letters you need page by page; for the Cerdagne, Saillagouse (volumes for 1811–1899,
1900–1919, 1920–1929, 1930–1940, 1941–1949 and 1950–1964).

*Checked:* the household censuses (series 6M, one register per commune and year: 1896, 1901, 1906, 1911, 1921…) list
house by house the age, birthplace and nationality of everyone, and the civil registers (9NUM2E…) are by commune
and decade; Spanish families who worked French farms across the border appear in both, with the Spanish village of
birth. The viewer (`docnumViewer/calculHierarchieDocNum/<udid>/…`) embeds base64 `src` ids; the whole image, about 7000
px wide, comes from `docnumserv/getImagePart/<src>/<base64("0/0/W/H/W/H")>`. Searches go through `requeteConstructor`
with a cookie jar. The military recruitment registers (series 1R) are also on Geneanet as free images (see
`resources-spain.md`, FamilySearch and Geneanet): they give birth date and place, the parents and where the man lived.

## Exile of 1939

The nominative lists of the internees of the camps (about 15,000 names from February to June 1939, more than 57,000
after October 1939) are described in the research guide of the Mémorial du camp d'Argelès-sur-Mer
(`memorial-argeles.eu/fr/le-memorial/outils-de-recherche.html`, *checked*), with the finding aids of the Archives
nationales (FRAN_IR_050044, FRAN_IR_054192), and in the Pyrénées-Orientales page on the camps
(`ledepartement66.fr/les-ressources-sur-les-camps-dinternement/`). The department's name database of the camps
(`archives-camps.cd66.fr/basescamps`) has a CAPTCHA: ask the user to search it; the list of the internees' files
(series 109W) is a PDF on the department's site (`LISTE_DOSSIERS_INTERNES_109W.pdf`), searchable as text.
*Reported:* Exilis (`exilis.1936-1946.eu`), a guide to archive sources on the exile; *Mémoire des hommes* of the French
Ministry of the Armed Forces (foreign volunteers of 1939–1940, war dead; 403 to automation). Deportees to the Nazi camps: see `resources-spain.md`, "Military and Civil War".

## Newspapers and directories

**Gallica (Bibliothèque nationale de France)** — digitised press and annuaires. *Reported, not checked:* the
Annuaire-guide de l'Aude (a directory of a département's tradespeople and officials).

## Courts

Judgments of French courts (for example a civil tribunal's) turn up in family archives: record the court in full, the
date and the number, and treat them as original documents.
