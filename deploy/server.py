"""Server of the tree's website: closed or public (PUBLIC_SITE), the private data only with the family's password.

PUBLIC_SITE chooses between two modes:
- 0 (the default), closed: without a valid session every GET (the page, the public media, /private/ and the originals)
  answers with a minimal login page of its own, with no data of the tree nor the web's bundle: status 200 for the
  page (/ and /index.html), 401 for everything else. Only /login, /logout and /health work without a session; the
  login form goes back to the path it was shown at. With a session everything is served, as in the public mode.
  POST /logout tells the web (X-Site-Mode: closed) to reload, so that it lands on the login page.
- 1, public: the public version to everybody and, with the password, the private data (the lock of the web).
To open the site to the public: PUBLIC_SITE=1 in .env and `docker compose up -d web`; to close it again, PUBLIC_SITE=0
(or remove the line) and the same command.

Serves three folders (build_site.py generates the first two):
- public (SITE_ROOT/public, or PUBLIC_DIR): the public version, to everybody;
- private (SITE_ROOT/private, or PRIVATE_DIR), at /private/: data.json and the media of the whole tree;
- the originals of the sources folder (SITE_ROOT/sources, or SOURCES_ROOT), at /<SOURCES_DIR>/ (`paths.sources` in
  families.yml, e.g. /sources/F001/acta.jpg).
The last two need a session: without it they answer 401 with no content (in the closed mode, the login page),
whatever the file.

POST /login (JSON {"password": …} or a form) checks the password and gives a signed session cookie (HttpOnly, Secure,
SameSite=Strict) that lasts SESSION_DAYS days, and a readable one (arbre_hint) that only tells the web there may be a
session. POST /logout removes both. Changing the password (or SESSION_SECRET) invalidates every session. Each IP gets
LOGIN_FREE_ATTEMPTS failures, and then waits 2^(failures - LOGIN_FREE_ATTEMPTS) seconds (at most 15 minutes) between
attempts; and with more than LOGIN_GLOBAL_LIMIT failures in an hour, from anywhere, nobody can try until they fall
below. While waiting the password is not even checked, and the answers say nothing but their status.

Environment variables: SITE_PASSWORD (required), PUBLIC_SITE (0), SITE_TITLE, SESSION_SECRET, SESSION_DAYS (30), PORT (8000), SITE_ROOT (/site),
PUBLIC_DIR, PRIVATE_DIR, SOURCES_ROOT, SOURCES_DIR (sources), TRUST_PROXY (0; 1 behind a proxy that sets
X-Forwarded-For, like Traefik), LOGIN_FREE_ATTEMPTS (5), LOGIN_GLOBAL_LIMIT (100).
The texts of the login page, which the family reads, are in Spanish like the web's (TEXTS, below): the server is a
single file with no access to the tree's i18n.
Standard library only.
"""

import hashlib
import hmac
import html
import json
import mimetypes
import os
import posixpath
import secrets
import threading
import time
from collections import deque
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

PASSWORD = os.environ.get("SITE_PASSWORD", "")
if not PASSWORD:
    raise SystemExit("Missing environment variable SITE_PASSWORD")
PUBLIC_SITE = os.environ.get("PUBLIC_SITE", "0") == "1"
TITLE = os.environ.get("SITE_TITLE", "Historia de la familia")
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))
PORT = int(os.environ.get("PORT", "8000"))
SITE_ROOT = Path(os.environ.get("SITE_ROOT", "/site"))
PUBLIC = Path(os.environ.get("PUBLIC_DIR") or SITE_ROOT / "public")
PRIVATE = Path(os.environ.get("PRIVATE_DIR") or SITE_ROOT / "private")
SOURCES = Path(os.environ.get("SOURCES_ROOT") or SITE_ROOT / "sources")
SOURCES_DIR = os.environ.get("SOURCES_DIR", "sources").strip("/")
TRUST_PROXY = os.environ.get("TRUST_PROXY", "0") == "1"
FREE_ATTEMPTS = int(os.environ.get("LOGIN_FREE_ATTEMPTS", "5"))
GLOBAL_LIMIT = int(os.environ.get("LOGIN_GLOBAL_LIMIT", "100"))
MAX_WAIT = 900
GLOBAL_WINDOW = 3600
# URL prefix -> folder; those after the public one need a session
PRIVATE_PREFIX = "/private"
ROOTS = {PRIVATE_PREFIX: PRIVATE, f"/{SOURCES_DIR}": SOURCES}
COOKIE, HINT = "arbre_session", "arbre_hint"
# Header of the answer to POST /logout that tells the web whether it has a public version to go back to
MODE_HEADER = ("X-Site-Mode", "public" if PUBLIC_SITE else "closed")
# Paths of the page itself: in the closed mode, the login page answers them with 200
PAGE_PATHS = ("/", "/index.html")
KEY = hashlib.sha256(b"arbre-session:" + PASSWORD.encode() + b"\0" + os.environ.get("SESSION_SECRET", "").encode()).digest()
PASSWORD_DIGEST = hashlib.sha256(PASSWORD.encode()).digest()
MAX_BODY = 4096
# On every answer: the site is not indexed, not framed and does not tell other sites where their visitors come from
COMMON_HEADERS = (
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "no-referrer"),
    ("X-Robots-Tag", "noindex, nofollow"),
    ("X-Frame-Options", "DENY"),
    ("Content-Security-Policy", "frame-ancestors 'none'"),
)


# Texts the family sees on the login page of the closed mode (in Spanish, like the web)
LANG = "es"
TEXTS = {
    "prompt": "Escribe la contraseña de la familia para entrar.",
    "password": "Contraseña",
    "enter": "Entrar",
    # The same for a wrong password and for too many attempts: the answer says nothing but its status
    "error": "No se ha podido entrar. Revisa la contraseña o prueba más tarde.",
}

LOGIN_PAGE = """<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: #faf8f4; color: #2b2622;
         font-family: system-ui, sans-serif; }}
  form {{ background: #fff; border: 1px solid #e2dcd1; border-radius: 16px; padding: 2rem 2.2rem; width: min(360px, 88vw);
         box-sizing: border-box; box-shadow: 0 8px 24px rgba(60, 40, 20, .08); text-align: center; }}
  h1 {{ font-family: "Iowan Old Style", Palatino, Georgia, serif; font-size: 1.6rem; margin: 0 0 .4rem; }}
  p {{ color: #8a8278; margin: 0 0 1.4rem; }}
  input {{ width: 100%; box-sizing: border-box; padding: .7rem .9rem; font: inherit; border: 1px solid #e2dcd1;
          border-radius: 10px; margin-bottom: .8rem; }}
  button {{ width: 100%; padding: .7rem; font: inherit; border: 0; border-radius: 999px; background: #7a4b2a;
           color: #fff; cursor: pointer; }}
  .error {{ color: #9b2c2c; margin: 0 0 1rem; }}
</style></head>
<body><form method="post" action="/login" id="login">
  <h1>{title}</h1>
  <p>{prompt}</p>
  {error}
  <input type="password" name="password" autofocus required autocomplete="current-password" aria-label="{password}">
  <input type="hidden" name="next" value="{next}">
  <button type="submit">{enter}</button>
</form>
<script>
  // The hash (the view and the person of the web) does not reach the server: it goes with the path to come back to
  document.getElementById("login").addEventListener("submit", e => {{ e.target.next.value += location.hash; }});
</script></body></html>"""


def safe_next(nxt: str) -> str:
    """A path of this site to go back to after the login (never another site's)."""
    ok = nxt.startswith("/") and not nxt.startswith("//") and "\\" not in nxt and nxt.isascii() and nxt.isprintable()
    return nxt if ok else "/"


def sign(expiry: int, nonce: str) -> str:
    mac = hmac.new(KEY, f"{expiry}.{nonce}".encode(), hashlib.sha256).hexdigest()
    return f"{expiry}.{nonce}.{mac}"


def new_token(now: float | None = None) -> str:
    return sign(int(now or time.time()) + SESSION_DAYS * 86400, secrets.token_hex(8))


def valid(token: str) -> bool:
    try:
        expiry, nonce, _mac = token.split(".")
        return int(expiry) > time.time() and hmac.compare_digest(sign(int(expiry), nonce), token)
    except ValueError:
        return False


class Throttle:
    """Failed logins: per IP (growing wait) and in total (a limit per hour)."""

    def __init__(self):
        self.lock = threading.Lock()
        self.fails: dict[str, tuple[int, float]] = {}  # ip -> (failures in a row, when the last was)
        self.recent: deque[float] = deque()

    def wait(self, fails: int) -> float:
        return min(2 ** (fails - FREE_ATTEMPTS), MAX_WAIT) if fails >= FREE_ATTEMPTS else 0

    def blocked(self, ip: str) -> bool:
        now = time.time()
        with self.lock:
            while self.recent and self.recent[0] < now - GLOBAL_WINDOW:
                self.recent.popleft()
            if len(self.recent) >= GLOBAL_LIMIT:
                return True
            fails, last = self.fails.get(ip, (0, 0.0))
            return now < last + self.wait(fails)

    def failed(self, ip: str) -> None:
        now = time.time()
        with self.lock:
            self.recent.append(now)
            fails, _ = self.fails.get(ip, (0, 0.0))
            self.fails[ip] = (fails + 1, now)
            # Forget whoever has not failed for a day, so that the table does not grow without end
            if len(self.fails) > 10000:
                self.fails = {k: v for k, v in self.fails.items() if v[1] > now - 86400}

    def succeeded(self, ip: str) -> None:
        with self.lock:
            self.fails.pop(ip, None)


THROTTLE = Throttle()


class Handler(BaseHTTPRequestHandler):
    server_version = "arbre"
    sys_version = ""

    def client_ip(self) -> str:
        # Behind the proxy, the address it saw is the last of X-Forwarded-For: the ones before it the client may forge
        fwd = self.headers.get("X-Forwarded-For", "") if TRUST_PROXY else ""
        return fwd.split(",")[-1].strip() or self.client_address[0]

    def authed(self) -> bool:
        try:
            jar = SimpleCookie(self.headers.get("Cookie", ""))
        except CookieError:
            return False
        return COOKIE in jar and valid(jar[COOKIE].value)

    def reply(self, status, body: bytes = b"", ctype="text/plain; charset=utf-8", headers=(), private=True):
        self.send_response(status)
        if body:
            self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if private:
            self.send_header("Cache-Control", "no-store")
        mine = {k for k, _ in headers}
        for k, v in (*(h for h in COMMON_HEADERS if h[0] not in mine), *headers):
            self.send_header(k, v)
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def cookies(self, token: str | None):
        """Set-Cookie headers of a new session (or, with None, those that remove it)."""
        age = SESSION_DAYS * 86400 if token else 0
        attrs = f"Path=/; Max-Age={age}; Secure; SameSite=Strict"
        return [("Set-Cookie", f"{COOKIE}={token or ''}; {attrs}; HttpOnly"),
                ("Set-Cookie", f"{HINT}={'1' if token else ''}; {attrs}")]

    def same_origin(self) -> bool:
        """A POST from another site (its Origin says so) is refused."""
        origin = self.headers.get("Origin")
        return not origin or urlsplit(origin).netloc == self.headers.get("Host", "")

    # --- routes
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if "\0" in path or "\\" in path:
            return self.reply(HTTPStatus.NOT_FOUND)
        # Normalized before choosing the folder: «..» cannot take a private path out of its prefix, nor into it
        path = posixpath.normpath("/" + path.lstrip("/"))
        if path == "/health":
            return self.reply(HTTPStatus.OK, b"ok")
        if not PUBLIC_SITE and path == "/login":
            nxt = safe_next(parse_qs(urlsplit(self.path).query).get("next", ["/"])[0])
            if self.authed():
                return self.reply(HTTPStatus.SEE_OTHER, headers=[("Location", nxt)])
            return self.login_page(nxt)
        if not PUBLIC_SITE and not self.authed():
            # Nothing of the site without a session: the page, anything else a 401 (the same page, for a person)
            status = HTTPStatus.OK if path in PAGE_PATHS else HTTPStatus.UNAUTHORIZED
            return self.login_page(safe_next(urlsplit(self.path).path), status=status)
        for prefix, root in ROOTS.items():
            if path == prefix or path.startswith(prefix + "/"):
                if not self.authed():
                    return self.reply(HTTPStatus.UNAUTHORIZED)
                return self.serve_file(root, path[len(prefix):], private=True)
        self.serve_file(PUBLIC, path, private=False)

    do_HEAD = do_GET

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in ("/login", "/logout"):
            return self.reply(HTTPStatus.NOT_FOUND)
        if not self.same_origin():
            return self.reply(HTTPStatus.FORBIDDEN)
        if path == "/logout":
            return self.reply(HTTPStatus.NO_CONTENT, headers=[MODE_HEADER, *self.cookies(None)])
        ip = self.client_ip()
        is_json = self.headers.get("Content-Type", "").split(";")[0].strip() == "application/json"
        if THROTTLE.blocked(ip):
            return self.refuse(HTTPStatus.TOO_MANY_REQUESTS, is_json)
        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
        except ValueError:
            length = -1
        if not 0 < length <= MAX_BODY:
            return self.reply(HTTPStatus.BAD_REQUEST)
        raw = self.rfile.read(length).decode(errors="replace")
        form = {} if is_json else parse_qs(raw)
        try:
            given = json.loads(raw).get("password", "") if is_json else form.get("password", [""])[0]
        except (ValueError, AttributeError):
            given = ""
        # Compared as digests, so that the time does not depend on the length either
        if not isinstance(given, str) or not hmac.compare_digest(hashlib.sha256(given.encode()).digest(), PASSWORD_DIGEST):
            THROTTLE.failed(ip)
            return self.refuse(HTTPStatus.UNAUTHORIZED, is_json, form)
        THROTTLE.succeeded(ip)
        cookies = self.cookies(new_token())
        if is_json:
            return self.reply(HTTPStatus.NO_CONTENT, headers=cookies)
        nxt = safe_next(form.get("next", ["/"])[0])
        self.reply(HTTPStatus.SEE_OTHER, headers=[("Location", nxt), *cookies])

    def refuse(self, status, is_json: bool, form=None):
        """A refused login: with no content, or, the form of the closed mode, its page again with the error."""
        if is_json or PUBLIC_SITE:
            return self.reply(status)
        self.login_page(safe_next((form or {}).get("next", ["/"])[0]), error=True, status=status)

    def login_page(self, nxt: str = "/", error: bool = False, status=HTTPStatus.OK):
        err = f'<p class="error" role="alert">{html.escape(TEXTS["error"])}</p>' if error else ""
        body = LOGIN_PAGE.format(lang=LANG, title=html.escape(TITLE), prompt=html.escape(TEXTS["prompt"]),
                                 password=html.escape(TEXTS["password"]), enter=html.escape(TEXTS["enter"]),
                                 error=err, next=html.escape(nxt))
        # With no-referrer the browser would send the form with «Origin: null», which same_origin refuses
        self.reply(status, body.encode(), "text/html; charset=utf-8", headers=[("Referrer-Policy", "same-origin")])

    def serve_file(self, root: Path, rel: str, private: bool):
        try:
            base = root.resolve()
            target = (base / rel.lstrip("/")).resolve()
            if target.is_dir():
                target = target / "index.html"
            ok = target.is_relative_to(base) and target.is_file()
        except (OSError, ValueError):
            ok = False
        if not ok:
            return self.reply(HTTPStatus.NOT_FOUND)
        size = target.stat().st_size
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        start, end = 0, size - 1
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes=") and "," not in rng:
            a, _, b = rng[6:].partition("-")
            try:
                start, end = (int(a), int(b) if b else size - 1) if a else (size - int(b), size - 1)
            except ValueError:
                pass
            start, end = max(start, 0), min(end, size - 1)
            if start > end:
                start, end = 0, size - 1
        partial = (start, end) != (0, size - 1)
        self.send_response(HTTPStatus.PARTIAL_CONTENT if partial else HTTPStatus.OK)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") else ""))
        self.send_header("Content-Length", str(max(end - start + 1, 0)))
        self.send_header("Accept-Ranges", "bytes")
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        # In the closed mode the public version is behind the session too: no cache in between keeps it
        media, page = ("public, max-age=3600", "no-cache") if PUBLIC_SITE else ("private, max-age=3600", "private, no-cache")
        self.send_header("Cache-Control", "no-store" if private else media if rel.startswith("/media/") else page)
        for k, v in COMMON_HEADERS:
            self.send_header(k, v)
        self.end_headers()
        if self.command == "HEAD":
            return
        with open(target, "rb") as f:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(1 << 16, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def log_message(self, fmt, *args):
        print(f"{self.client_ip()} {fmt % args}", flush=True)


if __name__ == "__main__":
    mimetypes.add_type("application/pdf", ".pdf")
    print(f"Listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
