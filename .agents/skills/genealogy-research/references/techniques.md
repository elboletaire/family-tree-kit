# Techniques for awkward sites

Most archive and newspaper sites are free but hostile to automation. Before declaring a site unusable, try these in
order: plain curl with a browser user agent → read the page's JavaScript for the real endpoint → a real browser
(Playwright) → ask the user to do it by hand. Say in the report which one worked.

## Plain HTTP first

- `curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"`,
  a cookie jar per site (`-c jar -b jar`), `--max-time 60` (some state servers are very slow), `-k` when the
  certificate chain is broken.
- Retry loops for flaky backends (HTTP 502/504): `for i in 1 2 3 4 5; do curl … && break; sleep 4; done`.
- Old hosts get renamed (`*.mcu.es` → `*.cultura.gob.es`): if a documented URL fails, try the new domain.

## Hidden JSON endpoints

Search pages built as JavaScript apps usually call a JSON or PHP endpoint. Open the app's main script (`*.js`) or
watch the network requests in Playwright, then call the endpoint directly with the same `Referer`. This is faster and
more reliable than driving the UI, and lets you loop over names, parishes or series ids.

## SPA with Playwright

For Angular/React apps with no usable endpoint:

```python
# /// script
# dependencies = ["playwright"]
# ///
from playwright.sync_api import sync_playwright
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(user_agent=UA, locale="ca-ES")
    page = ctx.new_page()
    images = []
    page.on("response", lambda r: images.append(r.url) if r.url.endswith(".jpg") else None)
    page.goto("https://…/#/"); page.wait_for_timeout(6000)
    page.fill("input:not([readonly])", "search terms"); page.keyboard.press("Enter")
    page.wait_for_timeout(14000)
    print(page.inner_text("body"))
    b.close()
```

(First run: `uv run --with playwright playwright install chromium`.) Generous waits beat clever selectors on slow
catalogues. Collect image URLs from network responses, then download them with curl — static files are usually not
protected.

## Challenge pages (Cloudflare-like, bunny.net, AWS WAF "Verification")

- Launch Chromium with `args=["--disable-blink-features=AutomationControlled"]`, a desktop UA and the site's locale.
- Load the home page first and wait (~10 s) until the title changes; then reuse the same context for every request
  (`ctx.request.get(url)` shares the cookies).
- Often only the HTML pages are protected; the PDFs or images they reference download with plain curl.
- If a site still returns a block page (Hemeroteca Digital of the Biblioteca Nacional de España, Geneanet, MyHeritage,
  some obituary aggregators) or a CAPTCHA, stop: do not try to solve CAPTCHAs. Tell the user which search to do by
  hand and what to look for.

## Search forms that lie

- Test a form with two different queries: if the results are identical, the parameter is being ignored (it happened
  with a newspaper's `?q=` and with date parameters of another). Find the parameter names the site's own UI sends.
- When a full-text form refuses automated queries, use a web search restricted to the site (`site:boe.es "<name>"`).
- If the built-in web search fails, `https://html.duckduckgo.com/html/?q=<q>` with curl and a regex over
  `result__a` / `result__snippet` is a working fallback.

## OCR, PDFs and images

- `pdftotext -layout` + `grep -i`; search with regexes that tolerate OCR errors (`rodr.gu.z`, optional accents, hyphenated
  line breaks `Gar-\s*cía`).
- OCR text is a finder, not evidence: open the page image, read the notice, crop it with Pillow and keep the crop.
  Tables in scanned gazettes are misread (a digit in a year, rows shifted across pages); cross-check with another
  column (age) or another document.
- Many newspaper PDFs are image-only: render the page and read it visually.
- When a date is known but full-text search fails, download all pages of the relevant issues (e.g. the last pages of
  each issue, where obituaries go) and read them.
- Large harvests: dump every hit (date + snippet) to a file and filter locally by dates and keywords.

## Social media without login

- X/Twitter: `https://api.fxtwitter.com/<user>/status/<id>` (JSON with text, date, media) or
  `https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=a`; media at original size with `?name=orig`.
- A municipal or institutional page that has disappeared: the Wayback Machine, `https://web.archive.org/web/<year>/<url>`
  redirects to the nearest snapshot (checked); `https://archive.org/wayback/available?url=<url>` says whether there is one.
- Whole threads or accounts: Wayback Machine CDX,
  `https://web.archive.org/cdx/search/cdx?url=twitter.com/<user>/status/*&output=json&fl=original,timestamp&collapse=urlkey`
  (also `x.com/…`), then fetch each id.
- Instagram and Facebook need login: look for the same image elsewhere (the same post on X, a local-history site).
- Never ask for or use the user's session cookies or passwords.

## Wikis and APIs

- MediaWiki sites (Wikipedia/Viquipèdia, local wikis): `…/w/api.php?action=query&list=search&srsearch=<q>&format=json`
  and `action=parse` are more reliable than scraping HTML.
- Blogger blogs: the JSON feed (`/feeds/posts/default?alt=json&q=<q>`) searches all posts.
