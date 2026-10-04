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
  books of 172 parishes (many town parishes kept their own books, and parishes changed diocese: check the inventory),
  and its digital archive (`arxiu.abev.net`, checked; AtoM, expired certificate: `curl -k`) has **images** of the
  sacramental books of a growing list of parishes (so far mostly Lluçanès, Moianès, Anoia, Bages and Ripollès; the big
  town parishes not yet), pastoral visits, the marriage contracts, inventories and wills of the Cúria Fumada and burial
  records; search `/index.php/informationobject/browse?topLod=0&query=<q>`, and ask `registre@bisbatvic.org` for the
  parishes not online. A book's record says whether it has digital objects (many described books have none), and the
  images need a free registered account;
  the Arxiu Diocesà i Capitular d'Urgell publishes a spreadsheet of surviving books per parish
  (`urgellensisecclesiaearchivia.bisbaturgell.org/registre-sacramental/`; visits by appointment). Many parish archives
  burnt in 1936: check what survives before asking. Barcelona Cathedral's marriage-licence books (1451–1905) are
  indexed by the Universitat Autònoma de Barcelona, behind a login.
- *Request only* (no index): the Archivo Histórico Diocesano de Oviedo (`archivo@iglesiadeasturias.org`; fee charged
  after delivery; marriage files before 1934 were lost in a fire) and the Archivo Diocesano de Ávila
  (`archivo@diocesisdeavila.com`). Give parish, type, approximate date and names. The Archivo Histórico Diocesano de
  Santander (`archivodiocesanodesantander.es/servicios`, checked: reachable) has the parishes of Cantabria from 1557,
  except the Valle de Villaverde (Trucíos) and the Valle de Mena, which belong to other dioceses; web form or
  `archivohistorico@diocesisdesantander.com`, with parish, date and, if known, book and folio (FamilySearch filmed the
  books).
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
- *Catastro de Ensenada*, a separate PARES portal (`pares.cultura.gob.es/catastro/`, reachable, JavaScript): images of
  the Respuestas Generales of the 1750s for every town of the Crown of Castile, by town — office holders, clergy,
  trades, incomes. The household books (libros de lo personal y de lo real) are in the provincial historical or
  municipal archives.

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
  paid dowries or grants to descendants of the founder kept genealogical proofs — a goldmine for older lines. The
  same portal (`/feaa/action/listado?buttons%5B2%5D=listadoMunicipales`; `curl -g` for the brackets) has box-level
  **inventories of municipal archives** (Carreño, Proaza, Tineo with the Escribanía de Muñalén, Belmonte de Miranda,
  Bimenes, Caso…) and the protocols of the Cangas de Onís and Llanes districts: padrones, hidalguía, personnel, draft,
  cemeteries, civil register, with the box numbers to quote in a request. Its municipal search (POST
  `buttons[15]=searchMunicipales`) returned nothing from curl: use a browser.
- *Asturias, municipal archives* (checked):
  - *Archivo Municipal de Gijón* — series pages at `gijon.es/es/creativos/<slug>` (`padrones-de-habitantes`,
    `registro-civil`, `registro-de-cementerios-1877-1972`, `expediente-191858`, `padrones-de-hidalguia`,
    `catastro-de-ensenada`, `recursos-para-investigadores`; Angular: a real browser or headless Chromium) with PDF **name
    indexes**: the municipal civil register 1817–1868, the burials of the Ceares cemetery 1877–1939, padrones 1900–1920,
    the emigrants who sailed to Havana 1858–1869, hidalguía 1585–1831. Find book and page in the index, then open the
    book under `fondos.gijon.es/fotoweb/archives/5004-Archivo/ayArchivo/<series folder>/` (FotoWeb: a folder's
    subfolders with `Accept: application/vnd.fotoware.collection+json`, its files with `…assetlist+json`; each asset's
    JSON lists previews up to 2400 px that curl downloads, and the original TIF comes through the renditions POST of the
    Hemeroteca entry). The cemetery books give date of burial, niche and later transfers of remains; the burial index is
    `Libros Cementerios/CGijónPersonas.pdf`. The padrones have no name index: about 1,000 pages per book, by street —
    find the address first. The draft books (`Libros Alistamientos`) were empty online in 2026.
  - *Archivo Municipal de Mieres* (`archivo.ayto-mieres.es/portalArchivo/`, AngularJS: a browser; guide of fonds as a PDF
    on `mieres.es`) — civil register, padrones (from 1910), draft records, electoral rolls, minutes, photos, and part of
    the records of the Fábrica de Mieres (1878–1959). `archivo@ayto-mieres.es`. Digitised padrones: 1910, 1920 and 1924
    (one PDF per tome, hundreds of pages, by parish and place), and births registered in 1925. Its search ORs the words.
    With Playwright: dismiss the cookie dialog («Rechazar todas»), click the result (`[ng-click^='goToDetail']`), and
    fetch the PDF the detail page links (`images/R000…/<file>.pdf?dl=<n>`) with `context.request.get` in the same
    session — plain curl gets an empty body.
  - *Archivo Municipal de Oviedo* (`oviedo.es/archivo-municipal/documentos-digitalizados`, viewers
    `archivomunicipal.oviedo.es/<padrones|hidalguias|registrocivil|acuerdos|catalogo|pergaminos>/visor.php`) — padrones
    of the city 1664–1833 and the rural concejo 1536–1831, ejecutorias de hidalguía with a surname search, the municipal
    civil register 1841–1869, minutes. «Temporarily unavailable» in 2026: try again, or write to
    `archivo.consultas@oviedo.es`.
  - The *Colegio Notarial de Asturias* (`asturias.notariado.org/portal/copias-de-archivos-de-protocolo`) keeps the Oviedo
    protocols over 25 years old not yet at the Archivo Histórico de Asturias (which has them up to about 1929): in person
    or `archivo@asturias.notariado.org`, with notary, date and proof of legitimate interest.
  - Mining: the *Archivo Histórico Minero* (`archivohistoricominero.org/?s=<q>`, volunteers) has more than 55,000 photos
    and documents of pits, companies and unions — context and photos, no personnel records (those are at Hunosa).
    Reported: union archives of the Fundación José Barreiro (`fsa-psoe.org/fjb/`) and the Fundación Juan Muñiz Zapico.
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
  (accent-insensitive). The Generalitat's open-data portal (`analisi.transparenciacatalunya.cat`, Socrata API, free, no
  key, checked) has the Arxiu Nacional de Catalunya's list of the 69,834 people tried by Francoist military courts
  1938–1978 (`/resource/3bjt-k7vu.json`: name, age, birth and home town, type of procedure, case number, years,
  sentence, executed or not, archive reference — the case number to ask the Tribunal Militar Territorial Tercer for the
  file); filter with `?$q=<text>`, `?cognoms=<SURNAME1 SURNAME2>`, `?municipi_resid_ncia=<Town>` or
  `?municipi_naixement=<Town>`. Same portal: the census of people who disappeared in the Civil War
  (`/resource/u2ix-2jr6.json`, 8,411, with army and date and place of disappearance), the mass graves
  (`/resource/6js6-vud6.json`), the camps and hospitals with Spanish refugees in France (`/resource/r2n5-8zfj.json`)
  and the mayors (`/resource/2v2p-vu4h.json`, only from 1979). The *Catàleg de l'Arxiu Municipal de Barcelona* (`catalegarxiumunicipal.bcn.cat`, checked;
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
  printed or in-house. Request with notary and year. Checked, in the same region:
  - *Archivo Municipal de Valladolid* (`www10.ava.es/amv/`) — about 20 databases: minute books from 1497 (digitised),
    household padrones by district (1919, 1924… being digitised), building and business licences from the 1920s with
    the holder's name, cemetery works, photos. GET `/amv/` for the `JSESSIONID`, then POST `do/search` with
    `fieldValueFreeText=<q>&bbdd=AA613827BBF0&page=1&domain=34` (that `bbdd` is the city council's; the others are in the
    form from POST `do/form`); HTML results with series, year, title and whether there is an image. Records under 50
    years old need the issuing office's permission.
  - *Diputación Provincial de Palencia* — the printed **electoral rolls 1890–1955 per town**, one PDF per year
    (`diputaciondepalencia.es/sitio/cultura/censos-electorales`, town page `…/censos-electorales-<town-slug>`; men,
    women from 1933; age, trade, address; no name search), and the **books of municipal office holders 1848–1933**
    (`…/sitio/cultura/libros-cargos-aytos`, town page `…/cargos-ayuntamientos-<town-slug>`; mayors, councillors,
    municipal judges; images only). The council keeps copies of most municipal archive inventories, seen in person.
  - *Diputación Provincial de Valladolid* — PDF inventories of each municipal archive it has organised, with their date
    ranges (`diputaciondevalladolid.es/en/archivos-municipales`): whether a village's padrones, draft or land records go
    back far enough before writing to the town hall. Its archive catalogue (`archivo.diputaciondevalladolid.es/portalArchivo/…`)
    is an AngularJS app (`curl -k`).
  - *Archivo de la Universidad de Valladolid* (`archivo.uva.es/opac/?lang=es`, since 2023; JavaScript and captcha: a real
    browser) — more than 100,000 descriptions before 1970, some with images: student files (bachilleres, licenciados,
    doctores), the University District, seminaries and colleges closed in the early 1800s, lawsuits. Careers of priests,
    teachers, lawyers and doctors of a district that covered several provinces.
  - *Mass graves of Castilla y León* (Cátedra de Memoria Histórica of the Universidad de Burgos,
    `www2.ubu.es/catedra_mhd/es/victimas`, spreadsheet `…/MemoriaHistoricaListadoMapaFosas.xlsx`) — about 680 graves:
    town, site, number of victims, date, sources; no names of victims.
  - Reported, not checked: the Archivo Histórico Diocesano de León (no books online; part of the province belongs to
    the Diocese of Astorga), the Archivo Municipal de León (padrones and civil registers 1841–1871 being digitised),
    volunteer blogs of parish archives.
- *Basque Country*: the Archivo Histórico Foral de Bizkaia (`apps.bizkaia.eus/ARIT/…`, a stateful servlet that does
  not script well: search by hand) holds municipal fonds and 19th-century censuses; the Portal de Archivos de
  Gipuzkoa (`artxiboataria.gipuzkoa.eus`) the provincial notarial archive at Oñati. The Archivo Municipal de Bilbao
  (`bilbao.eus`, «Archivos municipales», checked: reachable) has online only the municipal reports, minute books and
  street directories; its records before about 1935, old padrones included, are at the Archivo Foral de Bizkaia, and
  those of 1935–1990 are seen on site (padrones with proof of kinship).
- *Cantabria*: the Archivo Histórico Provincial de Cantabria (`culturadecantabria.com/archivo-historico`, reachable)
  holds the notarial protocols and the Catastro de Ensenada of Cantabria, with no online catalogue: requests to
  `ahpc@cantabria.es`. The *Centro de Estudios Montañeses* (`centrodeestudiosmontaneses.com`, checked; the `.es` does
  not resolve) has historical commercial directories of Santander, a newspaper section (Boletín de Comercio, Revista
  de Santander, Altamira), hospital records (Valdecilla, Maternidad), a photo archive, a survey of the municipal
  archives of Cantabria around 1950 and a list of the Cantabrian titles in Prensa Histórica; browse by section, no name
  index. Reported, not checked: padrones from 1838 in the Archivo Municipal de Torrelavega. The *ReCrea* repository of
  the Universidad de Cantabria (found through Hispana; CC BY) has digitised private fonds with item-level images, such
  as the letters received by a Santander politician around 1900 from correspondents in the villages, and the passenger
  books of the Compañía Trasatlántica's agents in Santander (Fondo Pérez y Cía.: emigrants to Havana and the Americas).
- *Madrid*: the Archivo de Villa keeps the city's padrones (1846–1965) for the reading room by appointment (being
  digitised with FamilySearch); the Archivo Regional de la Comunidad de Madrid and its Archivo Histórico de Protocolos
  publish only a selection in an AtoM catalogue.
- University repositories (doctoral theses as open PDFs) often transcribe archive series in full: download, run
  `pdftotext`, grep for surnames.

**Municipal archives** — padrones (censuses), local personnel files, cemetery services (niche holders). Rarely online;
list them as requests.

**National aggregators** — one search across many small repositories nobody would check one by one:

- *Hispana* (Ministerio de Cultura, `hispana.mcu.es`, checked) — harvests hundreds of regional, university, archive and
  library repositories (letters, photos, theses). Search
  `hispana.mcu.es/es/consulta/resultados_busqueda.do?busq_general=<q>` (`busq_general`, not `texto`).
- *Biblioteca Virtual del Patrimonio Bibliográfico* (`bvpb.mcu.es`, checked) — digitised historic books and manuscripts:
  local histories, guides, lists of guilds and confraternities. Same pattern,
  `bvpb.mcu.es/es/consulta/resultados_busqueda.do?busq_general=<q>`.
- *Europeana* (checked) — API `api.europeana.eu/record/v2/search.json?query=<q>&wskey=api2demo&rows=20` (`api2demo`, the
  public demo key), JSON; Spanish and foreign holdings together.
- *Biblioteca Digital Hispánica* (BNE, `bdh.bne.es`) — 403 to automation: a real browser.

**Biographical dictionaries** — the *Diccionario Biográfico electrónico* of the Real Academia de la Historia, now
«Historia Hispánica» (`historia-hispanica.rah.es`, also `dbe.rah.es`; reachable, JavaScript only: a real browser) —
about 50,000 signed biographies (clergy, military, officials, businessmen), at `/biografias/<id>-<slug>`. For the Basque
Country, the *Auñamendi Eusko Entziklopedia* (`aunamendi.eusko-ikaskuntza.eus`, «not a robot» check on search); for the
socialist movement, the *Diccionario biográfico del socialismo español* of the Fundación Pablo Iglesias (reCAPTCHA).

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

**Butlletí Oficial de la Generalitat de Catalunya** (1931–1939 and from 1977) — election results, appointments. The
Republic and exile issues (May 1931 – January 1939, plus 1956 and 1977; 18,660 entries) are indexed by title in open
data (`analisi.transparenciacatalunya.cat/resource/neug-8fgt.json?$q=<town or text>`, checked; page
`dogc.gencat.cat/ca/serveis/dogc-republica-i-exili/`), each with its PDF at
`documents.dadesobertes.gencat.cat/diaris-republica-exili/docs/<yyyynnnn>.pdf`: municipal judges, town councils and
their changes. Only titles are indexed: search in Catalan and in Spanish.

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
1917, Burgos 1890–1955, with age, trade and address). Not every province's BOP is there: those of Palencia (1833–2002,
`registro.do?id=1000101`) and Valladolid (`numeros_por_mes.do?idPublicacion=1004393`) and El Diario de Ávila (from
1898, `registro.do?id=1031388`) are in Prensa Histórica.

**Internet Archive mirror of Prensa Histórica** (collection `alanjas-newspaper-collections`, checked) — some titles
complete, each issue with PDF and OCR text (`_djvu.txt`), free (CC BY 4.0): e.g. El Diario Palentino, 40,023 issues
1882–1999 (`archive.org/details/ElDiarioPalentino`, items `ElDiarioPalentino_YYYYMMDD_NNNNN`) and El Día de Palencia.
List by date with `archive.org/advancedsearch.php?q=title:("<title>")&fl[]=identifier&fl[]=date&sort[]=date asc&output=json`
and download the text in bulk to grep — easier than the ministry's own viewer. Look for other titles there: the same
collection has, for example, El Distrito Universitario (León, teachers' lists and appointments, 1910s–1930s), whose
issues the ministry's viewer marks as restricted. The full-text search of the Internet Archive covers them all
(`archive.org/services/search/beta/page_production/?service_backend=fts&user_query=%22<phrase>%22&hits_per_page=50`).
Some items name their files differently from the item (`2004-01-16.pdf` instead of `<item>.pdf`): list them with
`archive.org/metadata/<item>/files`.

**El Norte de Castilla** (Valladolid, 1854–today, `hemeroteca.elnortedecastilla.es`, reachable) — pages at
`/DD/MM/YYYY/<page>/<hash>.html?subedition=VAL`; a paid subscription, but free from inside a town of the provinces of
Valladolid, Palencia, Segovia or Zamora (provincial council schemes with a QR poster and phone geolocation; Palencia's:
`proyectos.elnortedecastilla.es/hemeroteca-dip-pa/`): a relative who lives there can read it.

**Clergy** — the *Guía del estado eclesiástico* (national lists of clergy, mostly the hierarchy) is in the BNE (1818,
1831, 1862), Google Books and, the 1806 edition, the Biblioteca Digital de la Comunidad de Madrid
(`bibliotecavirtualmadrid.comunidad.madrid/bvmadrid_publicacion/es/bib/4026.do`, checked). Parish priests' postings are
in the diocesan bulletins (boletines eclesiásticos) and the provincial press.

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
are ORed). El Comercio's own archive (`hemeroteca.elcomercio.es`, from 1878) needs a subscription. La Nueva España
(Oviedo, 1936–1956, `hemerotecadigital.bne.es/hd/es/card?sid=9007449`) and La Voz de Avilés (from 1908, `sid=12752377`)
are in the Hemeroteca Digital of the BNE (a real browser).

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

**Basque Country press** (checked):

- *Euskariana* (Basque Government, `euskariana.euskadi.eus`), which replaces Liburuklik (closing; its old search lands on
  the notice) — books up to about 1940, the Euskal Hemeroteka Digitala (historical press), maps, photos, with OCR.
  Search `euskariana.euskadi.eus/euskadibib/es/bib/results.do?busq_general=<q>`; the default search does not look inside
  the OCR text: add `&ocr=true&queryType=TEXT` for full text.
- *Lau Haizeetara*, the digital library of the Biblioteca Foral de Bizkaia (`liburutegibiltegi.bizkaia.eus`, DSpace) —
  newspapers, reports of companies and institutions (mining, shipping), magazines of the 18th–20th centuries. Search
  `/discover?query=<q>`; it needs a full browser user agent (a bare «Mozilla/5.0» gets «Request Rejected»), and its
  PDFs (bitstreams) `curl -L` with a cookie jar. It holds the printed **electoral censuses of Bizkaia** (several years
  1898–1923, by town and street, with age and trade).
- *Atzoko Prentsa Digitala* of Koldo Mitxelena Kulturunea (Diputación Foral de Gipuzkoa,
  `w390w.gipuzkoa.net/WAS/CORP/DKPAtzokoPrentsaWEB/`) — more than 100 titles of Gipuzkoan and Basque press, 1812–2020
  (Euskal-Erria, Euzkadi 1931–1937, La Voz de España 1936–1980…), many with OCR. `…/databilaketa` (search),
  `…/aurkibidea` (titles), `…/argitalpen/<id>` (issues of a title).

**Premsa Digitalitzada de la Biblioteca de Catalunya**, **Trencadís** (Diputació de Barcelona local magazines), **RACO**
(Catalan journals) — worth a try for local magazines; JS-heavy. *Trencadís* (`trencadis.diba.cat`, checked: reachable)
holds about 300 titles of the municipal libraries of the province of Barcelona (local magazines, parish bulletins,
festival programmes, bulletins of cultural and hiking clubs) with full text; its search goes through a form with a CSRF
token (no stable GET URLs), titles at `/dem/catalog/as_fronts/collection?id=<n>`. Local papers of Catalan towns are also
in Prensa Histórica (search titles with `tipoResultados=BIB`, pages with `tipoResultados=PAG`).

**Catalan directories** — the *Anuario-Riera, Guía general de Cataluña* (1896–1905 and 1908), by province, judicial
district and town, with each trade's names and addresses, in the Biblioteca Patrimonial Digital of the Universitat de
Barcelona (`bipadi.ub.edu/digital/collection/anuarioriera`, checked; OCR, CONTENTdm API
`bipadiub.contentdm.oclc.org/digital/api/search/collection/anuarioriera/searchterm/<q>/maxRecords/<n>`, JSON). Its
successor, the Anuario General de España (Bailly-Baillière-Riera, 1912–1978), is in the Hemeroteca Digital of the
Biblioteca Nacional de España (real browser). For a page-level search with the OCR, the older CONTENTdm web services
work too: `bipadiub.contentdm.oclc.org/digital/bl/dmwebservices/index.php?q=dmQuery/anuarioriera/CISOSEARCHALL^<q>^all^and/title/title/1024/1/0/0/0/0/0/0/json`
lists the matching pages, and `dmGetItemInfo/anuarioriera/<pointer>/json` gives each page's OCR (field `transc`); crops
come straight from the IIIF server, `…/iiif/2/anuarioriera:<pointer>/pct:<x>,<y>,<w>,<h>/full/0/default.jpg`.

**ARCA — Arxiu de Revistes Catalanes Antigues** (Biblioteca de Catalunya, `arca.bnc.cat/arcabib_pro/`, checked) —
full-text OCR of old Catalan periodicals, including El Noticiero Universal into the 1970s (obituaries), La Publicitat,
La Humanitat and El Diluvio (shop advertisements give trades and addresses). DIGIBIS software: POST
`ca/consulta/resultados_ocr.do` with `general_ocr=on&busq_general=<q>`; page text
`catalogo_imagenes/descargarTextoOCR.do?path=<n>&posicion=<p>`. Strict rate limit: after about 25 quick requests the IP
is blocked for half an hour — wait several seconds between requests. The page image is
`catalogo_imagenes/imagen_id.do?idImagen=<n>&formato=jpg` (with a browser user agent).

**Hemeroteca of the Arxiu Històric de la Ciutat de Barcelona** (`ahcbdigital.bcn.cat/hemeroteca`, checked) — Diario de
Barcelona (1792–1994, with gaps), El Noticiero Universal, Solidaridad Nacional and other city papers. Search
`/hemeroteca/cerca-avancada?content=<q>&since=DD/MM/YYYY&until=DD/MM/YYYY`; each issue's viewer links (`handle_txt`) the
full OCR text of the issue.

**Recent deaths in Catalonia** (checked) — El 9 Nou (`el9nou.cat/osona-ripolles/defuncions/`, also
`/valles-oriental/defuncions/`; name, age and town, paginated `/page/<n>/`, online from 2022; its old archive is for
subscribers), `mesosona.cat/ca/defuncions-osona`, `diaridesabadell.com/obituaris/` and the funeral group Mémora
(`memora.es/ca/cercador-esqueles-defuncions-recents`, nationwide, recent only; Serveis Funeraris de Barcelona redirects
there).

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
  prosecuted people. Absence from them is not proof of absence. Checked:
  - *Gogora* (Instituto de la Memoria, la Convivencia y los Derechos Humanos, Basque Government) — about 21,000 dead of
    both sides in Euskadi, 1936–1945: name, home town, date and place of death, cause, burial and the source (civil or
    parish register, cemetery). Search app at
    `gogora.euskadi.eus/webgog00-aplikazi/es/contenidos/recurso_tecnico/gogora_aplik/eu_def/index.html`; the whole
    dataset downloads as open data,
    `opendata.euskadi.eus/contenidos/ds_general/victimas_guerra_civil/opendata/victimas_guerra_civil.json` (also `.xlsx`,
    `.xml`): grep it offline by surname or town.
  - *Todos (…) los Nombres* (`todoslosnombres.org/busqueda-de-victimas/`) — victims of the repression in Andalusia,
    Extremadura and North Africa; form `nombre`, `primer_apellido`, `segundo_apellido`, results by AJAX.
  - *Memoria Democrática de Asturias* (`memoriademocratica.asturias.es/fondos-documentales-y-bases-de-datos`, reachable):
    search of about 400 mass graves and links to every regional and national victims database; its victims and
    deportees searches were «temporarily unavailable» in 2026. The state census of victims of the Ministerio de Política
    Territorial y Memoria Democrática (`mptmd.gob.es/portal/memoria-democratica/registro-y-censo-estatal-de-victimas`,
    about 510,000 names) had no name search yet in 2026: check again.
  - Volunteer transcriptions of local lists (e.g. the blog Documentalismo Memorialista y Republicano for the executed of
    Gijón) are leads to the court-martial files, not sources.
  - Other regions have their own, e.g. `victimasdeladictadura.es` (Universidad de Castilla-La Mancha) and Desmemoriados
    (Universidad de Cantabria, `desmemoriados.org`, 20th-century Cantabria; browse by project, no name search).
- Deportees to the Nazi camps (republicans who had gone into exile in France): the databases of the Amical de
  Mauthausen (checked) — `republicanosdeportados.org` (form `NOM`, `COGNOM1`, `COGNOM2`, `LOCALITAT_NAIXEMENT`),
  `fallecidosenloscamposnazis.org` (about 5,260 dead) and the index `amical-mauthausen.org/en/projectes/bases-de-dades/`;
  and the *Arolsen Archives* (`collections.arolsen-archives.org/en/search/person?s=<surname>`, JavaScript, a real
  browser), with camp registration cards and displaced persons after the war. Reported: the person search of the
  Mauthausen Memorial and the French *Mémoire des Hommes* (Foreign Legion, deaths in deportation).
- The *Matrícula de Mar* (registered seamen) has no online index anywhere: the files that survive are in the naval
  archives (Ferrol for the Cantabrian coast, Cartagena). Write to them.

## Political and electoral

- *Congreso de los Diputados*, historical deputies 1810–1977 (`congreso.es/es/historico-diputados`, checked) — by name,
  district or election; JSON endpoint (take the session cookie from the page first): POST to
  `…/historico-diputados?p_p_id=historicodiputados&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=filtrarListado&p_p_cacheability=cacheLevelPage`
  with `_historicodiputados_nombre=<surname>&_historicodiputados_paginaActual=1&_historicodiputados_orden=0`; links to the
  credentials files. Search one word: several words always return nothing.
- *Senado*, personal files of próceres and senators 1834–1923
  (`senado.es/web/conocersenado/senadohistoria/senado18341923/senadores/index.html`, checked; the old
  `senadoreshistoricos/` path gives 500) — 3,251 digitised files with baptism certificates, proofs of income and
  property, titles; alphabetical list, one record at `…/senadores/fichasenador/index.html?id1=<n>`.
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
- Barcelona's cemeteries (Cementiris de Barcelona) have a grave locator for the nine city cemeteries
  (`cementiris.ajuntament.barcelona.cat/ca/localizacion`, POST `cementerios=<id>` (2 Montjuïc, 3 Les Corts, 9
  Poblenou…), `nombre`, `primer_apellido`, `segundo_apellido`): the form loads, but from curl every query came back
  empty in 2026 — try it in a real browser. Older burials are searched on request («Cerca de persona difunta antiga»,
  with name, cemetery and a range of up to five years; fee). No online locator was found for the cemeteries of
  Sabadell, Manresa or Vic; Terrassa's funeral company has one (`funerariaterrassa.cat/sepultures`, JavaScript,
  reported).
- Photos: the *Memòria Digital de Catalunya* (Consorci de Serveis Universitaris de Catalunya, `mdc.csuc.cat`, checked)
  gathers local photographic fonds (town councils, cultural centres, the Centre Excursionista de Catalunya and its
  survey of farmhouses), Civil War albums and posters; CONTENTdm, `/digital/search/searchterm/<q>` or the API
  `/digital/api/search/searchterm/<q>/maxRecords/<n>`.
- Places: the *Cartoteca Digital* of the Institut Cartogràfic i Geològic de Catalunya (`cartotecadigital.icgc.cat`,
  checked) has the municipal survey minutes of 1914–1936 (boundary maps that name the farmhouses), town plans and old
  photos: `/digital/collection/minutes/search/searchterm/<town>`. Barcelona's street names, with their former names and
  dates of change, are in the city's Nomenclàtor (`barcelona.cat/nomenclator/ca`, checked), which also certifies a
  change of name: to place an old address of a census or a directory.
- BillionGraves / Find a Grave: headstone photos plus a volunteer-transcribed index — trust the stone, not the index.
  Both answer plain requests (checked): `findagrave.com/memorial/search?lastname=<surname>&location=Spain`,
  `billiongraves.com/search/results?family_names=<surname>&country=Spain`; Spanish coverage is thin but growing.
- Regional cemetery sites list cemeteries per municipality; the cemetery service knows niche holders (phone/email).
- County archive photographic fonds (via Arxius en Línia in Catalonia) — group photos identified by the archive.
