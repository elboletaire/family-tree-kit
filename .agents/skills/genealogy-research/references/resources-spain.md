# Resources in Spain

Institutions are named in full (write them that way in sources too). "Technique" points to `techniques.md`. Checked in
2026; sites change — if a pattern fails, look at the page's JavaScript or network requests before giving up.

## Civil and church records

**Registro Civil (Ministerio de Justicia)** — birth, marriage and death certificates from 1871. Literal certificates
give parents, grandparents (births), ages and birthplaces. Requested online by the person, direct descendants or anyone
with legitimate interest. The most reliable source for anything after 1871; suggest ordering them whenever a date or
place is in doubt. Family-held certificates are often photographed with a phone: see the `add-document` skill.

**Diocesan and parish archives** — baptisms, marriages, burials before 1871 (and after). Most have no online index:
the next step is an email request with parish, type, approximate date and names. Some have one:

- *Archivo Histórico Diocesano de Palencia* — public index of sacramental records older than 100 years
  (`archivodiocesanopalencia.es/archivodiocesano/ad2/ad.html`, guest mode). The page is a JS app over a JSON endpoint:
  `GET …/ad2/consultar.php?tabla=<bautizos|matrimonios|defunciones>&consulta=<JSON {"nombre":"…","apellido1":"…","apellido2":"…"}>&permisos=&con_datos=<number of fields>`
  with `Referer: …/ad2/ad.html`; the response is `SQL&[[json…]]` (parse after the first `&`). Uppercase, unaccented
  values. Each entry gives parish, book and folio and an index id. Book images need a registered user; literal copies
  are requested by email (a few per week) quoting book, folio and index id. Validate the index against one certificate
  the family already has before trusting it.
- Look for similar indexes per diocese; volunteer blogs often inventory which parish books survive per village
  (including parish household censuses).

**FamilySearch** — huge index, but search needs login (the API refuses anonymous calls); its wiki pages per locality
(which collections and archives exist) are public. **Geneanet** indexes (derived from FamilySearch) are useful but
Cloudflare-blocked for automation; users can save index cards as PDF. Index transcriptions contain surname errors.

## Archives

**PARES — Portal de Archivos Españoles (Ministerio de Cultura)** — catalogue of the state archives (Archivo Histórico
Nacional, Centro Documental de la Memoria Histórica, Archivo General de Indias…), many with images.

- Host `pares.cultura.gob.es` (the old `pares.mcu.es` fails); may need `curl -k` and a browser user agent.
- Description: `…/ParesBusquedas20/catalogo/show/<id>`; search: `…/catalogo/find?nm=&texto=<term>`.
- Images: with a cookie jar, open `show/<id>`, read `dbCode=` from the HTML, then fetch
  `…/ParesBusquedas20/ViewImage.do?accion=42&txt_descarga=1&dbCode=<db>&txt_id_imagen=<n>&txt_zoom=10&txt_contraste=0&txt_polarizado=&txt_brillo=10.0&txt_contrast=1.0&txt_totalImagenes=<N>&txt_transformacion=-1`
  for n = 1..N, and assemble a PDF with Pillow.
- Valuable collections: *Causa General* (post-war criminal files on events of 1936–1939), the *fichero
  político-social* index cards of the Centro Documental de la Memoria Histórica (Salamanca) — these list surname
  variants, parents, birthplace, occupation, residence, union and party membership.
- *Portal de Víctimas de la Guerra Civil y la Dictadura* (`…/victimasGCFPortal/`): search is a POST — GET
  `buscadorSencilloFilter.form` with a cookie jar, read the hidden `_csrf`, POST
  `textSearch=<term>&_csrf=<token>&Submit=Buscar` to `buscadorSencillo.form`; detail `detalle.form?idpersona=<id>`.
  Finds, for instance, teachers' purge files (expedientes de depuración) held at the Archivo General de la
  Administración.
- *Movimientos Migratorios* (emigrants): often times out.

**Censo-Guía de Archivos de España** — which archive holds a given fonds (e.g. the papers of a charitable foundation).

**Military archives** — Archivo General Militar (Ávila, Guadalajara, Segovia) hold service files; not online,
request by email.

**Archivos históricos de protocolos** (notarial, per province) — wills and deeds; request with notary and year.

**Regional archive catalogues**:

- *Archivo Histórico de Asturias* — online catalogue (`archivosdeasturias.info/feaa/…`), item-level descriptions with
  box/file signatures. Plain curl works; URL parameters `loadDetailFondo&idTipo=`, `loadDetailCuadro&idCuadro=`,
  `loadDetailSerie&idCuadro=…&idTipo=` can be looped to dump whole series. Charitable foundations (obras pías) that
  paid dowries or grants to descendants of the founder kept genealogical proofs — a goldmine for older lines.
- *Arxius en Línia* (Departament de Cultura, Generalitat de Catalunya) — unified catalogue of the Arxiu Nacional de
  Catalunya, provincial historical archives and county archives (arxius comarcals), with images. The web is an
  Angular SPA, but its search backend is a plain JSON API that answers curl (no browser, no CAPTCHA needed):
  `https://backend.arxiusenlinia.cultura.gencat.cat/unitat/search/basic?text=<q>&cercarEn=QUALSEVOL&tipusDoc=TOTS&nomesDigitals=<true|false>&page=1&size=100&sort=data_inici_dt,asc`
  (`cercarEn=TITOL` to search titles only). Each result gives archive, fonds, `codiReferencia`, dates, title,
  description and, when digitised, `objecteDigitalUrl` (a static JPG that downloads with curl) and `reservat`
  (restricted: keep for family consultation only). Be gentle: one request every second or two. The record page for
  a human is `https://arxiusenlinia.cultura.gencat.cat/#/cercabasica/detallunitat/<codiReferencia>`. For multi-page
  digitised files, `…/unitat/objects?codiReferencia=<codiReferencia>` lists every image and PDF of the unit (no
  browser needed). Useful fonds: Govern Civil (fines, border-crossing cards, permits — the files usually carry
  birth date and place), the Ministry of Finance's provincial delegations (padrons and lists of the urban and rural
  tax contribution, per municipality and year: who owned houses and land), municipal padrons deposited in county
  archives (older ones are often digitised; 20th-century ones usually not — list them as archive requests with their
  reference), the "Cementiris de Catalunya" photographic survey (photos of every cemetery, niches and gravestones
  included, often restricted) and county photographic fonds (group photos with names identified by the archive).
  The Arxiu Nacional de Catalunya military-trials search shows a reCAPTCHA: leave it to the user.
- University repositories (doctoral theses as open PDFs) often transcribe archive series in full: download, run
  `pdftotext`, grep for surnames.

**Municipal archives** — padrones (censuses), local personnel files, cemetery services (niche holders). Rarely online;
list them as requests.

## Official gazettes

**BOE — Boletín Oficial del Estado and Gaceta de Madrid (historical)** — appointments, competitions, seniority lists
(escalafones, often with date of birth), pensions, draft lists, court and inheritance edicts.

- Direct PDFs: `https://www.boe.es/boe/dias/YYYY/MM/DD/pdfs/A0xxxx-0xxxx.pdf`; Gaceta
  `https://www.boe.es/gazeta/dias/YYYY/MM/DD/pdfs/GMD-YYYY-NNN.pdf`. `pdftotext -layout` + grep.
- The full-text search forms reject automated queries: use a web search with `site:boe.es "<given name> <surnames>"`
  and follow the links.
- Pensions transfer "from the day after the death" of the previous holder — a way to date a death (label it as an
  inference).

**Boletines oficiales de provincia** (BOP, one per province, from the 1830s) — electoral rolls with age and trade,
juror lists, expropriations naming landowners, draft council minutes (alistamiento), teachers, municipal secretaries,
court edicts, applications that copy whole birth records. Most are digitised in the Biblioteca Virtual de Prensa
Histórica (below).

**Butlletí Oficial de la Generalitat de Catalunya** (1931–1939 and from 1977) — election results, appointments.

**Revista de Estudios de la Vida Local** (INAP) — lists of local-administration civil servants from the 1940s.

**Catálogo Colectivo de la Red de Bibliotecas de los Archivos Estatales** (`mcu.es/ccbae/`) — digitised
Republican-era bulletins from the Civil War (e.g. military corps bulletins), browsable by issue with PDFs.

## Newspapers and obituaries

Obituaries (esquelas) are the richest single source for the 20th century: date of death and age, spouse, all
children with their spouses, grandchildren, parish, cemetery, sometimes occupation or business. Anniversary notices
(1st, 10th…) sometimes give the exact birth date. Corrections appear a day or two later (misprinted names, wrong
titles): look for them.

**Biblioteca Virtual de Prensa Histórica (Ministerio de Cultura)** — `prensahistorica.mcu.es`, free full-text OCR
over provincial gazettes and hundreds of regional newspapers. Slow server: curl with a browser UA, `-k`, cookie jar,
`--max-time 60+`.

- List results: `…/es/consulta/resultados_busqueda.do?general_ocr=on&busq_general=%22<q>%22&orden=fecha&descendente=false&posicion=1&forma=lista&cuantos=50`
  (page with `posicion=51,101…`).
- Issue: `…/es/catalogo_imagenes/grupo.do?path=<path>` (`&posicion=<page>&presentacion=pagina`).
- OCR text of a page: `…/catalogo_imagenes/descargarTextoOCR.do?path=<path>&posicion=<page>`.
- Page image: find `imagen_id.do?idImagen=<id>` in the page HTML, then `…imagen_id.do?idImagen=<id>&formato=jpg&registrardownload=0`.
- PDF export goes through a job queue: not automatable; use the image.
- Store the `path` of each hit so it can be reopened.

**Hemeroteca Digital de la Biblioteca Nacional de España** — blocked for automation (Cloudflare, 403 even with
Playwright). Ask the user to search it by hand if needed.

**La Vanguardia** (Barcelona, 1881–today, free) — `hemeroteca.lavanguardia.com/search.html?q=<q>&fecha_inicio=YYYY-MM-DD&fecha_final=YYYY-MM-DD&pagina=N`.
Other date parameters (`by`, `ey`…) are silently ignored. Preview pages sit behind a WAF "Verification" challenge:
technique "challenge pages". The page PDFs (`hemeroteca-paginas.lavanguardia.com/…pdf`) then download with plain curl.
Many are image-only: read obituaries on the rendered image.

**ABC** (Madrid and Sevilla) — search `abc.es/archivo/buscador/?titulo=<q>&tipo=hemeroteca` with Playwright (the
`?q=` form returns the same list for any query). Pages `abc.es/archivo/periodicos/abc-madrid-YYYYMMDD-PP.html`, PDFs
`static.abc.es/media/hemeroteca/YYYY/MM/DD/abc-madrid-YYYYMMDD-PP.stamp.pdf` (curl). Daily "Fallecidos en Madrid" lists
give name and age.

**Pandora** (Arxiu Municipal de Girona, `pandora.girona.cat`) — El Punt, Diari de Girona, Avui, Los Sitios; free OCR.
bunny.net challenge: technique "challenge pages" (load `index.vm?lang=ca&view=hemeroteca` first, reuse the context).

- Results: `results.vm?o=&w=%22<q>%22&f=&s=0&g=pages&c=0&lang=ca&view=hemeroteca`; hit `details.vm?…&s=<n>…`.
- Page PDF: `pdf.raw?query=id:%22<issue>%22&page=<p>&view=hemeroteca&lang=ca`; image `jpeg.raw?id=<id>&page=<p>`.
- Browse a title by date: `results.vm?q=parent:<titleid>&s=<offset>…` — binary-search by date to read whole issues.
- Content: birth announcements, candidate lists with party and position, birthday columns of public figures (exact
  birth dates), short obituaries with age and origin, expropriation edicts, draft lists with birth date and place.
- Regional editions do not cover every county's obituaries.

**XAC Premsa** (Xarxa d'Arxius Comarcals, `xacpremsa.cultura.gencat.cat/pandora/`) — same software (`view=premsa`,
needs `g=p&c=1` to list hits); local and county press of Catalonia from the 19th century.

**Premsa Digitalitzada de la Biblioteca de Catalunya**, **Trencadís** (Diputació de Barcelona local magazines), **RACO**
(Catalan journals) — worth a try for local magazines; JS-heavy.

**Regional dailies with obituary sections** — e.g. Regió7 (Manresa): web obituaries only from mid-2021, paginated
`…/necrologiques/pagina-<n>/` (download all, grep); older archive is paid. Funeral homes sometimes re-host the printed
obituary page as a PDF: search the funeral home's site.

**Obituary aggregators** — esquelasdeasturias.com (archive only from 2024; old ids return 410), rememori (Cloudflare),
others unreliable. Use them to discard homonyms rather than as the main route.

Paid or offline archives (La Nueva España, El Comercio, El 9 Nou…): tell the user where the paper copies are (regional
library, the paper's own archive).

## Military and Civil War

- **buscar.combatientes.es** — index of combatants and military bulletins of both sides, with PARES links. URL
  `/resultados/<Given>/<Surname1>/<Surname2>` (`-` as wildcard). Its "Nombre distinto" block lists spelling variants —
  use them everywhere. Frequent 502 errors: retry in a loop with a few seconds' sleep.
- Draft lists (quintos, reemplazo) in the Gaceta, BOPs and local press: birth date and place of every young man; the
  army sometimes kept listing boys who had died — check against the family.
- Which side someone served on follows from the issuing body and date of the bulletin.
- Regional memorial databases (e.g. Memoria Democrática de Asturias) and local-history sites list victims, mayors,
  prosecuted people. Absence from them is not proof of absence.

## Political and electoral

- Candidate lists and results in local press (municipal elections of 1931, 1934, 1970s onwards).
- Provincial councils (diputaciones) sometimes publish scanned lists of municipal office holders per village.
- Official council websites for current office holders (living people: notes only).

## Social media and the web

- Local-history threads and posts by councillors, parties, associations: portraits, letters, clippings. X/Twitter:
  technique "social media without login".
- Wikipedia/Viquipèdia and municipal heritage pages for context (buildings, events); their unsourced paragraphs are
  flagged as such.
- Personal and company websites (a relative's own page, company registers via BORME aggregators) — public roles only.
- Business directories to confirm a family business named in testimony.

## Cemeteries and photos

- BillionGraves / Find a Grave: headstone photos plus a volunteer-transcribed index — trust the stone, not the index.
- Regional cemetery sites list cemeteries per municipality; the cemetery service knows niche holders (phone/email).
- County archive photographic fonds (via Arxius en Línia in Catalonia) — group photos identified by the archive.
