# Resources in Argentina

For branches that emigrated to Argentina (mostly through the port of Buenos Aires). The Spanish side of the same people
is in `resources-spain.md`. Institutions are named in full. Each entry says whether it was checked or only reported by
another tree or a guide: a reported one is a lead to try, not a promise that it works.

## Arrivals

**CEMLA — Centro de Estudios Migratorios Latinoamericano** — search of passenger arrivals at the port of Buenos Aires,
at `cemla.com/buscador/` (*checked:* reachable). Reported: covers mainly 1882 to the mid-1970s, with gaps, and over six
million records (1882–1932 and 1938–1950 according to PARES): name, age, nationality, marital status, occupation, ship
and date; town or province of birth only from about 1924. Search by given name and surname of the person who arrived;
try surname variants and the Spanish form of the given name. The search (`search.cemla.com`, in an iframe) has a
captcha on every query: by hand, or ask the user.

**entradadepasajeros.com.ar** — reported: more than 340,000 immigrants who arrived in the 19th century, with images of
some original books; useful for the gaps of the CEMLA search (*checked:* reachable).

**Archivo General de la Nación (Argentina)** — reported: its online service «antecedentes migratorios» (it needs an
account on the official system) covers arrivals from 1882 to 1937 and can issue an official certificate of the
migratory record; passports and immigration papers from the early 19th century are held there too and are requested
by mail. Useful for arrivals before the CEMLA coverage.

**FamilySearch** — the collection «Argentina, Passenger Lists 1901–1922» (reported). The search needs a login and the
API refuses anonymous calls: see `resources-spain.md`. Its wiki pages on emigration and immigration for Argentina are
public.

**Spanish side of the voyage** — the Archivo General de la Administración keeps the passport register books of the
Spanish Consulate General in Buenos Aires for 1933–1939 (name, birthplace, age, trade, address, reason, photo;
request only; reference in the Censo-Guía de Archivos). The *Fundación Archivo de Indianos – Museo de la Emigración*
(Colombres, Asturias, `archivodeindianos.es`) holds fonds of emigrant societies, including the Centro Asturiano de
Buenos Aires (from 1913, with a members' register), and of the Centros Asturianos of Havana, Mexico and Tampa; its
digital archive (`archivodeindianos.es/archivo-digital/`) searches by name and place after a free sign-up (copies about
1 € per image; `info@archivodeindianos.es`).
Reported, unreachable when checked: `navegante.es` (a census of emigrants) and the Brigham Young University
«Ancestros Inmigrantes» project (municipal passport files of Asturias and Galicia).

## Civil and church records

FamilySearch holds birth, marriage and death records of people who lived in Buenos Aires, some with images (reported;
login needed). Its index gives the reference of the record (circunscripción or sección, tomo, acta, year), which the
city's registry needs.

**Registro del Estado Civil y Capacidad de las Personas of the City of Buenos Aires** — certified copies of births,
marriages and deaths of the Capital, any year, as a PDF by email: the procedure «Solicitud de partidas»
(`buenosaires.gob.ar/tramites/solicitud-partidas`, checked; urgent version `…/solicitud-partidas-urgentes`), through
Trámites a Distancia with a miBA account. Without the record's reference it costs more; about 15 working days, 3
urgent (only with the exact reference). The archived documentation of 1886–1959 (rectifications, court orders) is
released only with a court order (reported by a genealogy guide). The online account is Argentine: a relative or
contact there may have to order it.

## Provinces: Salta

- *Boletín Oficial de la Provincia de Salta* — an unofficial mirror on GitHub (`github.com/ediedrich/boletines-salta/releases`,
  checked) has one PDF per issue for 1908–1909 and 1944 onwards, with a text layer: download a year through the GitHub
  API, `pdftotext` and grep. Probate edicts («SUCESORIO: … cita y emplaza por treinta días a herederos y acreedores de
  …») date a death to the weeks before the first publication and name the court.
- *Archivo y Biblioteca Históricos de Salta* (`bibliotecasyarchivosalta.gob.ar`) — colonial times to about 1960, including
  a civil-registry series (1889–1970) and the civil courts (probate files); copies by form.
- *Registro Civil de la Provincia de Salta* (`registrocivilsalta.gob.ar`) — records since 1889, digitised; certificates
  ordered online for a fee.
- *Archivo del Arzobispado de Salta* — parish books 1634–1950 open, later ones restricted; by letter.
- *Biblioteca Provincial «Dr. Victorino de la Plaza»* (Salta) — its catalogue
  (`biblioteca.culturasalta.gov.ar/catalogo/opac_css/`, PMB; «en mantenimiento» when checked) lists the paper holdings
  of its newspaper library, such as El Intransigente (1927–1981). No Salta daily of 1925–1955 was found digitised
  anywhere: the catalogue tells which issues exist, to ask for photos or visit.

## National gazettes and registers

- *Boletín Oficial de la República Argentina* at the Internet Archive (`archive.org/details/boletinoficialdelarepublicaargentina`,
  checked) — about 56,000 scanned issues from 1893, each with PDF and OCR text (`*_djvu.txt`), free (CC0). Up to 1949 one
  item per day (`…_1ra_seccion_YYYY-MM-DD`); from 1950 the second section, with the court notices of the federal and
  Capital courts (succession edicts «cita por diez días a herederos y acreedores de …», bankruptcies, companies), has
  items of its own (`…_2da_seccion_YYYY-MM-DD`). Full-text search as JSON:
  `archive.org/services/search/beta/page_production/?service_backend=fts&user_query=%22<word>%22%20collection%3Aboletinoficialdelarepublicaargentina&hits_per_page=50`;
  by date: `archive.org/advancedsearch.php?q=collection:boletinoficialdelarepublicaargentina+AND+date:[1951-01-01+TO+1951-12-31]&fl[]=identifier&output=json`.
  The OCR is noisy: try spelling variants. The official `boletinoficial.gob.ar` only searches recent decades well.
- *Registro Oficial / Registro Nacional de la República Argentina* (Centro de Documentación e Información del Ministerio
  de Economía, `cdi.mecon.gob.ar/greenstone/cgi-bin/library.cgi?a=p&p=about&c=registr1`, checked) — laws and decrees with
  military ranks, appointments, pensions and leave, 1810–1910, full-text search (Greenstone).
- Reported, not checked: the *Anuario Kraft* («Gran guía general …», annual from 1885), a directory of businesses,
  professionals and officials by town, in HathiTrust (403 to automation: real browser) and some years in Google Books;
  Dateas (`dateas.com/es/bora`), a private search of the national and provincial gazettes, only from 1999.

## Newspapers and societies

- *Hemeroteca Digital of the national library of Argentina* (`hemerotecadigital.bn.gob.ar`, checked; needs `curl -k`) —
  La Nación and La Prensa (early years free, scattered later years restricted) and the exile paper España
  Republicana (1929–1974).
- *Caras y Caretas* (Buenos Aires, 1898–1939, with social pages and portraits) is in the Hemeroteca Digital of the
  Biblioteca Nacional de España (blocked for automation: ask the user).
- *Ressorgiment* (Buenos Aires, 1916–1972), the monthly of the Catalan community (Casal Català, later Casal de
  Catalunya), complete in ARCA of the Biblioteca de Catalunya (`arca.bnc.cat/arcabib_pro/ca/consulta/registro.do?id=2385`,
  checked; 677 issues, OCR): members, deaths, arrivals and departures, subscribers in the provinces. The library
  publishes an index of it as a PDF (`bnc.cat/publicacions/159/index_ressorgiment.pdf`).
- *Correo de Galicia* (Buenos Aires, 1898–1978) in Galiciana (`biblioteca.galiciana.gal/es/consulta/registro.do?id=579858`,
  checked: «Ver números» opens the issues; how many years are online, not checked): Galician societies, deaths and
  voyages. The Consello da Cultura Galega's emigrant-press collection (`consellodacultura.gal/fondos_documentais/hemeroteca/`)
  adds more emigrant titles.
- *Ibero-Amerikanisches Institut* (Berlin) digital collections (`digital.iai.spk-berlin.de/viewer/`) — Argentine
  magazines with full text, such as Fray Mocho (1912–1929): society pages and photos of the 1910s–1930s. Search
  `/viewer/search/-/<term>/1/-/-/`. Anti-bot page for curl and fetch: real browser.
- Spanish mutual societies kept member registers: the Centro Asturiano and the Hospital Español de Buenos Aires
  (requests by email); no society register (Casal de Catalunya, Centro Gallego, Centro Asturiano) is online. City
  cemeteries (Chacarita, Recoleta, Flores) have no public name search: request through the city's online procedures.

## Other provinces

- *Archivo Histórico de la Provincia de Tucumán* (`archivoh-beta.tucuman.gov.ar/Pi/index/68`, reachable) — local
  newspapers (El Orden, La Unión, Noticias, El Periódico, Crítica) and notarial records, wills and powers 1573–1960, with
  copies on request; no online name search. La Gaceta of Tucumán keeps its own archive from 1912, not public: ask the
  newspaper. The Centro de Estudios Genealógicos de Tucumán has its old bulletins (mostly colonial transcriptions) free
  to download (reported).
- Provincial genealogy centres (Salta, Tucumán and others) are listed by the *Instituto Argentino de Ciencias
  Genealógicas* (`institutoargentinodecienciasgenealogicas.com.ar/sitios-de-interes/`, checked); several have only a
  social-media page.

## Compiled trees

*Genealogía Familiar* (`genealogiafamiliar.net`, checked) — a large volunteer database of mostly Argentine families,
with transcribed documents; search `search.php?mylastname=<SURNAME>&lnqualify=equals&mybool=AND`. A compiled tree, not a
source: a lead to the documents it cites.

## Method

Cross the sources: each has gaps, and the same person can appear with the surname misspelled or with the second surname
dropped. Once the arrival gives a town or province of origin, go back to Spain with it: parish indexes, civil
registry certificates and the state archives (PARES) in `resources-spain.md`.
