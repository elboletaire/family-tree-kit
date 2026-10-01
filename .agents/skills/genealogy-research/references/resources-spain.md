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
- *Basque Country — Registros Sacramentales of the Archivo Histórico de Euskadi* (formerly Dokuklik; checked) — free
  index (no images) of 5.6 million baptisms, marriages and burials, 1490–1900, from the diocesan archives of Bilbao,
  San Sebastián and Vitoria (including a few Cantabrian parishes of the Diocese of Bilbao). Page
  `https://www.artxibo.euskadi.eus/webartxi00-container/es/ad53aArchivoHistoricoWar/sacramentales/maintSimple`; its
  JSON endpoints answer curl: POST `Content-Type: application/json` to `…/sacramentales/busquedaBautismo`
  (`busquedaMatrimonio`, `busquedaDefuncion`) with `archivosDiocesanos:["1","2","3"]`, `tipoBusqueda:["1","2","3"]`,
  `bautismoHijoApellido1`, optional `anioInicial`/`anioFinal`, plus the DataTables fields (`draw`, `start`, `length`,
  `columns:[{data:"x"}]`, `order`) — without them it answers an error or 0. Exact match, no wildcards; the surname
  field matches the person, either spouse or the deceased.
- *Archivo Histórico Eclesiástico de Bizkaia* (checked) — the full record of a Bizkaia entry, with book, folio,
  signature and digital image reference:
  `https://internet.aheb-beha.org/paginas/indexacion/n_ficha_bautismos.php?id_bautismo=<n>` (`n_ficha_difuntos.php?id_difunto=`,
  `n_ficha_matrimonios.php?id_matrimonio=`), where `<n>` is the `idoriginal` of the Euskadi index. Latin-1 pages.
  Copies are requested from the record page («Solicitar»), with a fee.
- *Archivo Histórico Diocesano de San Sebastián* (Gipuzkoa, before 1901; checked) —
  `https://artxiboa.mendezmende.org/es/busque-partidas-sacramentales/bautismo.html` (`matrimonio.html`,
  `defuncion.html`); GET parameters `bp[apellidoPrimero]`, `bp[apellidoSegundo]`, `bp[nombre]`, `bp[anio]`,
  `bp[anioMargen]`, `bp[padre…]`, `bp[madre…]`, and it accepts `_` and `%` wildcards. Copies about €3 (plain) or €10
  (certified) plus postage.
- *Archivo General Diocesano de Valladolid* (checked) — index of records older than 100 years, mostly rural parishes
  and incomplete, capped at 300 results: `archivogeneraldiocesano-va.com/ArchivoPartidas.web`, a POST form
  (`__xISPOSTBACK=1&__xSOURCE=btnBuscar&__xSERVEREVENT=Click&chkTodas=1&…&txtNombre=&txtApellido1=&txtApellido2=`,
  Latin-1). Certificates and digital images are ordered from it (a few euros each).
- *Catalonia* (no name index; checked): the Arxiu Diocesà de Barcelona sends certificates by email
  (`arxiu.esglesia.barcelona/despatx-de-partides/`; duplicates of parish books from 1918, marriage files, dispensations
  1480–1927; a few euros each); the Arxiu i Biblioteca Episcopal de Vic (`abev.net`) publishes a PDF inventory of the
  books of 172 parishes (many town parishes kept their own books, and parishes changed diocese: check the inventory);
  the Arxiu Diocesà i Capitular d'Urgell publishes a spreadsheet of surviving books per parish
  (`urgellensisecclesiaearchivia.bisbaturgell.org/registre-sacramental/`; visits by appointment). Many parish archives
  burnt in 1936: check what survives before asking. Barcelona Cathedral's marriage-licence books (1451–1905) are
  indexed by the Universitat Autònoma de Barcelona, behind a login.
- *Request only* (no index): the Archivo Histórico Diocesano de Oviedo (`archivo@iglesiadeasturias.org`; fee charged
  after delivery; marriage files before 1934 were lost in a fire) and the Archivo Diocesano de Ávila
  (`archivo@diocesisdeavila.com`). Give parish, type, approximate date and names.
- *Reported by other trees, not checked:* sacramental indexes of the Diocese of Almería and of the Diocese of
  Orihuela-Alicante (the latter through `arxparrvalencia.org`, which answers 403 to plain curl: ask the user to search
  it by hand or use technique "challenge pages").
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

**Military archives** — the Archivo General Militar (Ávila, Guadalajara, Segovia) and the other Defence archives
have nothing online beyond indexes; files are requested by email. Search the index first, then write with the
reference:

- *Biblioteca Virtual de Defensa* (`bibliotecavirtual.defensa.gob.es/BVMDefensa/`, checked) — free full text of the
  Diario Oficial del Ministerio de la Guerra (1888–1931; postings, promotions, retirements, pensions, deaths of
  officers and of military civil servants), of the Ministerio del Ejército and of Marina, the Colección Legislativa,
  many escalafones and the printed **index of personal files of the Archivo General Militar de Segovia** (Hidalguía,
  1959–1963, nine volumes: «Surname Surname, Given.-Corps, year of entry»), which tells you a file exists before you
  ask for it. Same software as the Biblioteca Virtual de Prensa Histórica: load `es/consulta/busqueda.do` for a
  session cookie, then `es/consulta/resultados_ocr.do?busq_general=<q>&general_ocr=on` (a quoted phrase plus one more
  term works; a phrase alone may return nothing); issues per month at
  `publicaciones/numeros_por_mes.do?idPublicacion=2&anyo=YYYY`; page text at `descargarTextoOCR.do?path=&posicion=`.
- *Archivo General Militar de Guadalajara* (checked) — Patrimonio Cultural de Defensa publishes about 150 indexes as
  PDF/CSV/XLSX (disciplinary battalions, prisoners, commuted sentences, some recruitment zones and regiments) at
  `patrimoniocultural.defensa.gob.es/es/centros/archivo-general-militar-guadalajara/documentos`: download them all and
  grep. Copies by email to the archive.
- *Archivo General Militar de Ávila* — Civil War units by box and folder, no name index; request by email.
- *Courts-martial after 1939* — those of Madrid and the centre (Tribunal Militar Territorial Primero) are at the
  Archivo General e Histórico de Defensa, with an index (also searchable through `buscar.combatientes.es/TMT1/`);
  those of Asturias, Galicia and León at the Archivo Intermedio Militar Noroeste (Ferrol), whose online name index
  does **not** cover Asturias — access needs prior authorisation from the Tribunal Militar Territorial Cuarto. Catalan
  ones are at the Arxiu Nacional de Catalunya (below).
- *Archivo Histórico de la Armada «Álvaro de Bazán»* (Ciudad Real) — navy personnel files 1603–1936 and the
  «Matrículas y pesca» section (1737–1928: seamen's registers); no name index, request by email. Port authorities
  (former Juntas de Obras del Puerto) keep their own archives of pilots and port staff (see the Censo-Guía).

**Company archives** — large companies kept personnel registers. Example: the *Archivo Histórico de Hunosa* (Langreo,
Asturias, `archivohunosa.es`) holds the coal companies of the Asturian basins (registers of staff from the 1890s);
its catalogue rejects curl, but its PDF inventories per company are searchable as text; reading room by request.

**Teachers** — besides the purge files of the Archivo General de la Administración (through the Portal de Víctimas),
the Ministry of Education gives away the old printed escalafones as PDFs with OCR (e.g. the 1933 roll of women
teachers, with date and place of birth: `libreria.educacion.gob.es`, search «escalafón maestras»). Provincial gazettes
print appointments, interim lists and leaves.

**Universities** — the Archivo Histórico de la Universidad de Oviedo (`archivo.uniovi.es/ms-opac/search?q=<q>`, plain
GET) only holds files from 1934 (fire); the Archivo Universitario de Valladolid's catalogue has a captcha. Older degree
files of the Universidad Central (Madrid) are in the Archivo Histórico Nacional (PARES).

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
- *Catalonia, more*: the *Banc de la Memòria Democràtica* of the Memorial Democràtic (`banc.memoria.gencat.cat`,
  checked; 1931–1980: people tried by Franco's courts, prisoners, deportees, exiles, militias) has an open JSON API:
  `https://dedalo4.bancmemorial.extranet.gencat.cat/dedalo/lib/dedalo/publication/server_api/v1/json/records?code=85df5s%244Kue%C3%B1wQw5O2p4J1G9&table=global_search&lang=lg-cat&sql_filter=name_surname LIKE '%<q>%'`
  (accent-insensitive). The *Catàleg de l'Arxiu Municipal de Barcelona* (`catalegarxiumunicipal.bcn.cat`, checked;
  business licences, building permits, photographs) answers POST `/api/search` with
  `{"q":"<q>","operator":"ALLWORDS","page":1,"itemsPerPage":40}`; Barcelona's padrons have no name index. Some
  councils publish **indexed padrons**: Manlleu's of 1905 and 1920 as ArcGIS layers
  (`services.arcgis.com/WNsrZDHEJ88NE4N8/arcgis/rest/services/habitants_padro_1920/FeatureServer/0/query?where=…&outFields=*&f=json`,
  checked), and the Universitat Autònoma de Barcelona's *Xarxa de padrons històrics* (`dagapp.cvc.uab.cat/xarxes/`,
  `?c=cercador&co=<surname>&an1=1800&an2=1970`, checked) for a handful of Llobregat towns. County archives publish
  genealogy guides saying which padrons and civil registers stay at each town hall (in person only). The provincial
  gazette of Barcelona (1833–1997) is online at the Diputació's archive (`diba.cat/web/arxiu/boph`, reported).
- *DARA — Documentos y Archivos de Aragón* (`dara.aragon.es`, checked: reachable) — catalogue of the provincial
  historical archives of Huesca, Zaragoza and Teruel and other Aragonese archives. Reported useful, not checked: electoral
  rolls of Aragon (1890–1955).
- *Provincial gazette portals* — reported by other trees: the Diputación de Jaén's historical BOP
  (`bophistorico.dipujaen.es`, checked: reachable), the Diputación de Granada's archive (BOP 1833–2002) and the
  Diputación de Almería's Pandora. Try them when the Biblioteca Virtual de Prensa Histórica lacks an issue.
- Reported, not checked: the Archivo de la Real Chancillería de Granada (lists of cases of the Audiencia Territorial),
  the Archivo Histórico Provincial de Almería (fonds of the provincial Treasury delegation) and the Archivo Histórico
  Municipal de Úbeda (padrones online).
- *Archivos de Castilla y León* (`archivoscastillayleon.jcyl.es`, checked: reachable) — the provincial historical
  archives of the region (protocols, Treasury, Civil Government) described only at series level; notarial indexes are
  printed or in-house. Request with notary and year.
- *Basque Country*: the Archivo Histórico Foral de Bizkaia (`apps.bizkaia.eus/ARIT/…`, a stateful servlet that does
  not script well: search by hand) holds municipal fonds and 19th-century censuses; the Portal de Archivos de
  Gipuzkoa (`artxiboataria.gipuzkoa.eus`) the provincial notarial archive at Oñati.
- *Madrid*: the Archivo de Villa keeps the city's padrones (1846–1965) for the reading room by appointment (being
  digitised with FamilySearch); the Archivo Regional de la Comunidad de Madrid and its Archivo Histórico de Protocolos
  publish only a selection in an AtoM catalogue.
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

**Biblioteca Digital de Castilla y León** (`bibliotecadigital.jcyl.es`, checked) — same software as the Biblioteca
Virtual de Prensa Histórica (`general_ocr=on` is needed for full text; page text through `descargarTextoOCR.do`):
BOP of León (1833–2009) and Burgos (1857–2010), Diario de Burgos, printed electoral rolls (Valladolid 1898, Palencia
1917, Burgos 1890–1955, with age, trade and address). Not every province's BOP is there.

**Asturias** — the *Hemeroteca Municipal de Gijón* (`hemeroteca.gijon.es`, checked: about 25 Gijón titles,
1865–1990s, free OCR) runs on FotoWeb: GET
`https://fondos.gijon.es/fotoweb/archives/5000-Hemeroteca/?q=<term> and 571:1860-01-01T00:00:00~~1936-12-31T23:59:59&p=<n>`
with `Accept: application/vnd.fotoware.assetlist+json`; to download an issue, POST
`{"href":"<asset>.info/__renditions/ORIGINAL"}` to `/fotoweb/services/renditions` (content type
`application/vnd.fotoware.rendition-request+json`) and fetch the link it returns (a PDF with text layer). Quoted
phrases are not reliable; filter hits locally. Its civil-registry summaries (births, marriages, deaths of the week)
are a substitute for missing certificates. The *Biblioteca Virtual del Principado de Asturias*
(`bibliotecavirtual.asturias.es`, checked: about 40 titles from 1843) is DIGIBIS too: POST
`i18n/consulta/resultados_ocr.cmd` with `busq_general=<q>&general_ocr=on&tipoResultados=BIB&tipo=elem` (several words
are ORed). El Comercio's own archive (`hemeroteca.elcomercio.es`, from 1878) needs a subscription.

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

**Other press archives** — reported by other trees, not checked: the Diputación de Jaén's digital newspaper library
(with the Instituto de Estudios Giennenses), the Biblioteca Hemeroteca Municipal de Tarragona (through Pandora) and
the archives of El Periódico de Catalunya.

**Premsa Digitalitzada de la Biblioteca de Catalunya**, **Trencadís** (Diputació de Barcelona local magazines), **RACO**
(Catalan journals) — worth a try for local magazines; JS-heavy.

**ARCA — Arxiu de Revistes Catalanes Antigues** (Biblioteca de Catalunya, `arca.bnc.cat/arcabib_pro/`, checked) —
full-text OCR of old Catalan periodicals, including El Noticiero Universal into the 1970s (obituaries), La Publicitat,
La Humanitat and El Diluvio (shop advertisements give trades and addresses). DIGIBIS software: POST
`ca/consulta/resultados_ocr.do` with `general_ocr=on&busq_general=<q>`; page text
`catalogo_imagenes/descargarTextoOCR.do?path=<n>&posicion=<p>`. Strict rate limit: after about 25 quick requests the IP
is blocked for half an hour — wait several seconds between requests.

**Hemeroteca of the Arxiu Històric de la Ciutat de Barcelona** (`ahcbdigital.bcn.cat/hemeroteca`, checked) — Diario de
Barcelona (1792–1994, with gaps), El Noticiero Universal, Solidaridad Nacional and other city papers. Search
`/hemeroteca/cerca-avancada?content=<q>&since=DD/MM/YYYY&until=DD/MM/YYYY`; each issue's viewer links (`handle_txt`) the
full OCR text of the issue.

**Regional dailies with obituary sections** — e.g. Regió7 (Manresa): web obituaries only from mid-2021, paginated
`…/necrologiques/pagina-<n>/` (download all, grep); older archive is paid. Funeral homes sometimes re-host the printed
obituary page as a PDF: search the funeral home's site.

**Obituary aggregators** — esquelasdeasturias.com (archive only from 2024; old ids return 410), rememori
(Cloudflare), others unreliable. Reported by other trees, not checked: tanatorio.pro, esquelas.es and the funeral-home
directories. Use them to discard homonyms rather than as the main route.

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

- Municipal cemetery locators: Oviedo (`cementeriomunicipaloviedo.com/difuntos/`, checked: POST `/difuntos/buscar/`
  with `nombre`, `defuncion` (year) and `pagina` from 0; JSON with HTML inside; the date is the burial date, burials
  from the late 1930s, transfers between graves listed) and Valladolid's El Carmen (municipal funeral company NEVASA,
  reported). Gijón and Madrid (Almudena) have none: request by email.
- Barcelona's cemeteries (Cementiris de Barcelona) no longer have an online search of the deceased: the burial books
  are searched on request («Cerca de persona difunta antiga», in person, with name, cemetery and a range of up to five
  years; fee).
- BillionGraves / Find a Grave: headstone photos plus a volunteer-transcribed index — trust the stone, not the index.
- Regional cemetery sites list cemeteries per municipality; the cemetery service knows niche holders (phone/email).
- County archive photographic fonds (via Arxius en Línia in Catalonia) — group photos identified by the archive.
