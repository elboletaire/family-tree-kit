# Resources in Andorra

For families with a branch from the Andorran valleys or that crossed through them. Spanish sources are in
`resources-spain.md` (the diocese of Urgell, which includes Andorra, is there), French ones in `resources-france.md`;
techniques in `techniques.md`. Institutions are named in full.

In Andorra the parish books were also the civil register until the 20th century: there is no separate civil
registry to ask for older births, marriages and deaths.

**Arxiu Nacional d'Andorra — «Arxiu en línia»** (`www.arxiuenlinia.ad/fotoweb/`, checked; free, no login to search) —
the national archive's catalogue on FotoWeb (the same software as some Spanish municipal archives): archives
`5004-Documents-textuals` (about 67,500 items, in folders per fonds: the communal archives of each parish, such as the
Arxiu Comunal de Canillo, the Arxiu de les Set Claus, family fonds), `5002-Fotografies`, `5005-Audiovisual` and
`5013-Catàlegs`.

- Search the metadata (names included): `GET /fotoweb/archives/<archive>/?q=<term>` with the header
  `Accept: application/vnd.fotoware.collection+json`; next pages from `assets.paging.next` with
  `Accept: application/vnd.fotoware.assetlist+json`.
- Previews (800 to 1600 px) of each item are public: `GET <asset href>.info` with
  `Accept: application/vnd.fotoware.asset+json`, field `previews`.
- The parish archives (folder `APC` and the like, with baptisms, marriages and deaths) show no items to anonymous
  users: the parish books are consulted in the reading room (Andorra la Vella) or with a registered account, and the
  originals stay in the parishes (microfilms at the archive). Ask with the parish, the person and the years.
- Duplicates of the Andorran parish books of the 1860s are at the Arxiu Diocesà i Capitular d'Urgell (its spreadsheet
  of books, in `resources-spain.md`).
- No population census is online. FamilySearch's wiki mentions Andorran parish registers of 1851–1876 (images only,
  login; reported, not checked).

A surname that does not appear in the archive's catalogue at all may be a Spanish form of a Pyrenean one, or the
family's «from Andorra» may mean the neighbouring valleys of the Pallars or the Alt Urgell: search the variants (with
and without accent, `B`/`V`) in Arxius en Línia as well before concluding.
