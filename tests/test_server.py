#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""The site's server (deploy/server.py) with a fictional public version, private data and originals, in a temporary
folder. Public mode (PUBLIC_SITE=1): without a session every private route answers 401 with no content; a forged,
tampered or expired cookie is worth nothing; «..» does not get out of the folders; the password gives the session
cookie; and the failed attempts are throttled per IP and in total. Closed mode (the default): without a session no
byte of the site is served, only a login page, and the password opens everything.

Usage: uv run tests/test_server.py
"""

import http.client
import importlib
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

CODE = Path(__file__).resolve().parent.parent
SERVER = CODE / "deploy" / "server.py"
PASSWORD = "clau-de-prova"
SOURCES_DIR = "fonts"
FILES = {
    "public/index.html": "<!doctype html><title>Public</title>",
    "public/media/abc.jpg": "public image",
    "private/data.json": '{"access": "private"}',
    "private/media/F001/000-t.jpg": "private image",
    "sources/F001/acta.pdf": "original",
    "outside.txt": "never served",
}


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Server:
    def __init__(self, root, **env):
        self.port = free_port()
        self.env = {**os.environ, "SITE_PASSWORD": PASSWORD, "SITE_ROOT": str(root), "PORT": str(self.port),
                    "SOURCES_DIR": SOURCES_DIR, "TRUST_PROXY": "1", **env}
        self.proc = subprocess.Popen([sys.executable, str(SERVER)], env=self.env, stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                if self.request("GET", "/health")[0] == 200:
                    return
            except OSError:
                time.sleep(.05)
        raise RuntimeError("the server did not start")

    def request(self, method, path, body=None, headers=None, ip="10.0.0.1"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request(method, path, body=body, headers={"X-Forwarded-For": ip, **(headers or {})})
        res = conn.getresponse()
        data = res.read()
        conn.close()
        return res.status, res.headers, data

    def login(self, password=PASSWORD, ip="10.0.0.1", form=False, headers=None):
        if form:
            body, ctype = f"password={password}", "application/x-www-form-urlencoded"
        else:
            body, ctype = json.dumps({"password": password}), "application/json"
        return self.request("POST", "/login", body, {"Content-Type": ctype, **(headers or {})}, ip)

    def stop(self):
        self.proc.terminate()
        self.proc.wait()


def session_cookie(headers):
    return next(c.split(";")[0] for c in headers.get_all("Set-Cookie") if c.startswith("arbre_session="))


class SiteServer(unittest.TestCase):
    """The public mode."""
    PRIVATE = ["/private/data.json", "/private/media/F001/000-t.jpg", "/private/", "/private",
               f"/{SOURCES_DIR}/F001/acta.pdf", f"/{SOURCES_DIR}/", f"/{SOURCES_DIR}/F001/missing.pdf",
               "/private/nothing.json", "/media/../private/data.json", "/media/%2e%2e/private/data.json",
               f"/%2e%2e/{SOURCES_DIR}/F001/acta.pdf"]

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        for rel, text in FILES.items():
            (cls.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (cls.root / rel).write_text(text)
        cls.server = Server(cls.root, PUBLIC_SITE="1")
        os.environ.update({"SITE_PASSWORD": PASSWORD, "SITE_ROOT": str(cls.root)})
        sys.path.insert(0, str(SERVER.parent))
        cls.module = importlib.import_module("server")

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        cls.tmp.cleanup()

    def get(self, path, cookie=None, method="GET"):
        return self.server.request(method, path, headers={"Cookie": cookie} if cookie else {})

    def test_the_public_version_for_everybody(self):
        status, headers, body = self.get("/")
        self.assertEqual((status, body), (200, FILES["public/index.html"].encode()))
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(headers["X-Robots-Tag"], "noindex, nofollow")
        self.assertEqual(self.get("/media/abc.jpg")[0], 200)
        self.assertEqual(self.get("/health")[0], 200)

    def test_private_routes_without_a_session(self):
        for method in ("GET", "HEAD"):
            for path in self.PRIVATE:
                with self.subTest(method=method, path=path):
                    status, headers, body = self.get(path, method=method)
                    self.assertEqual((status, body), (401, b""))
                    self.assertEqual(headers["Cache-Control"], "no-store")
                    self.assertEqual(headers["X-Robots-Tag"], "noindex, nofollow")

    def test_forged_tampered_or_expired_cookies(self):
        token = self.module.new_token()
        expiry, nonce, mac = token.split(".")
        forged = [
            "arbre_session=1",
            "arbre_session=9999999999.00.00",
            f"arbre_session={int(expiry) + 1}.{nonce}.{mac}",  # the expiry changed: the signature no longer matches
            f"arbre_session={expiry}.{nonce}.{'0' * len(mac)}",
            "arbre_session=" + self.module.new_token(time.time() - 31 * 86400),  # signed, but expired
            'arbre_session="unbalanced',
            "arbre_hint=1",
        ]
        for cookie in forged:
            with self.subTest(cookie=cookie):
                self.assertEqual(self.get("/private/data.json", cookie)[:3:2], (401, b""))

    def test_traversal_stays_inside_each_folder(self):
        _, headers, _ = self.server.login(ip="10.0.1.1")
        cookie = session_cookie(headers)
        for path in ["/../outside.txt", "/%2e%2e/outside.txt", "/media/..%2f..%2foutside.txt",
                     "/private/..%2f..%2foutside.txt", f"/{SOURCES_DIR}/%2e%2e/%2e%2e/outside.txt",
                     "/%2e%2e%2f%2e%2e%2fetc%2fpasswd", "/index.html%00.jpg", "/..\\outside.txt"]:
            for c in (None, cookie):
                with self.subTest(path=path, session=bool(c)):
                    status, _, body = self.get(path, c)
                    self.assertIn(status, (401, 403, 404))
                    self.assertNotIn(b"never served", body)

    def test_login_and_logout(self):
        self.assertEqual(self.server.login("wrong", ip="10.0.2.1")[:3:2], (401, b""))
        status, headers, body = self.server.login(ip="10.0.2.1")
        self.assertEqual((status, body), (204, b""))
        cookies = headers.get_all("Set-Cookie")
        session = next(c for c in cookies if c.startswith("arbre_session="))
        for attr in ("HttpOnly", "Secure", "SameSite=Strict", "Path=/"):
            self.assertIn(attr, session)
        self.assertTrue(any(c.startswith("arbre_hint=1;") and "HttpOnly" not in c for c in cookies))
        cookie = session.split(";")[0]
        for path in ("/private/data.json", "/private/media/F001/000-t.jpg", f"/{SOURCES_DIR}/F001/acta.pdf"):
            status, headers, body = self.get(path, cookie)
            self.assertEqual(status, 200, path)
            self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(self.get("/private/data.json", cookie)[2], FILES["private/data.json"].encode())
        # A form (without JavaScript) goes back to the site
        status, headers, _ = self.server.login(ip="10.0.2.1", form=True)
        self.assertEqual((status, headers["Location"]), (303, "/"))
        status, headers, _ = self.server.request("POST", "/logout")
        self.assertEqual((status, headers["X-Site-Mode"]), (204, "public"))
        self.assertTrue(all("Max-Age=0" in c for c in headers.get_all("Set-Cookie")))

    def test_login_from_another_site_is_refused(self):
        status, headers, _ = self.server.login(ip="10.0.3.1", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)
        self.assertIsNone(headers.get("Set-Cookie"))

    def test_attempts_per_ip(self):
        ip = "10.0.4.1"
        for _ in range(5):
            self.assertEqual(self.server.login("wrong", ip=ip)[0], 401)
        # Waiting, not even the right password is checked; the answer says nothing else
        status, headers, body = self.server.login(ip=ip)
        self.assertEqual((status, body, headers.get("Set-Cookie")), (429, b"", None))
        self.assertEqual(self.server.login(ip="10.0.4.2")[0], 204)  # another IP, unaffected
        time.sleep(1.1)  # the first wait is of 1 s
        self.assertEqual(self.server.login(ip=ip)[0], 204)
        self.assertEqual(self.server.login("wrong", ip=ip)[0], 401)  # the success reset the count

    def test_global_limit(self):
        server = Server(self.root, PUBLIC_SITE="1", LOGIN_GLOBAL_LIMIT="6")
        try:
            for i in range(6):
                self.assertEqual(server.login("wrong", ip=f"10.1.0.{i}")[0], 401)
            self.assertEqual(server.login(ip="10.1.1.1")[0], 429)
        finally:
            server.stop()

    def test_forwarded_for_is_ignored_without_a_proxy(self):
        server = Server(self.root, PUBLIC_SITE="1", TRUST_PROXY="0")
        try:
            for i in range(5):
                server.login("wrong", ip=f"10.2.0.{i}")
            self.assertEqual(server.login(ip="10.2.1.1")[0], 429)  # all come from 127.0.0.1
        finally:
            server.stop()



class ClosedSiteLinkPreview(unittest.TestCase):
    """The closed mode with a link preview: its image and its tags are the only thing served without a session."""

    TAGS = '<meta property="og:title" content="Preview">'

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        for rel, text in {**FILES, "public/share/og-abc.jpg": "collage",
                          "public/share/meta.json": json.dumps({"tags": cls.TAGS})}.items():
            (cls.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (cls.root / rel).write_text(text)
        cls.server = Server(cls.root)

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        cls.tmp.cleanup()

    def test_the_image_is_served_without_a_session(self):
        status, headers, body = self.server.request("GET", "/share/og-abc.jpg")
        self.assertEqual((status, body), (200, b"collage"))
        self.assertEqual(headers["Content-Type"], "image/jpeg")

    def test_the_login_page_has_the_tags(self):
        for path in ("/", "/index.html"):
            status, _, body = self.server.request("GET", path)
            self.assertEqual(status, 200)
            self.assertIn(self.TAGS.encode(), body)
            self.assertIn(b'<form method="post" action="/login"', body)

    def test_nothing_else_of_the_folder_or_the_site(self):
        for path in ("/share/meta.json", "/share/", "/share/og-abc.jpg/../../private/data.json",
                     "/share/%2e%2e/private/data.json", "/media/abc.jpg", "/private/data.json"):
            with self.subTest(path=path):
                status, _, body = self.server.request("GET", path)
                self.assertEqual(status, 401)
                self.assertNotIn(b"collage", body)
                self.assertNotIn(b'"access"', body)

    def test_a_missing_image_is_a_404(self):
        self.assertEqual(self.server.request("GET", "/share/nothing.jpg")[0], 404)


class ClosedSiteServer(unittest.TestCase):
    """The closed mode, the default one: nothing without a session."""

    # Every file of the site, and paths that do not exist
    PAGES = ["/", "/index.html", "/media/../index.html", "/?next=//evil.example"]
    PATHS = [*PAGES, "/media/abc.jpg", "/media/", "/missing.html", "/private/data.json",
             "/private/media/F001/000-t.jpg", "/private/", f"/{SOURCES_DIR}/F001/acta.pdf", f"/{SOURCES_DIR}/",
             "/media/%2e%2e/private/data.json"]

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        for rel, text in FILES.items():
            (cls.root / rel).parent.mkdir(parents=True, exist_ok=True)
            (cls.root / rel).write_text(text)
        cls.server = Server(cls.root)  # PUBLIC_SITE is not set: closed

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        cls.tmp.cleanup()

    def get(self, path, cookie=None, method="GET"):
        return self.server.request(method, path, headers={"Cookie": cookie} if cookie else {})

    def assert_login_page(self, body):
        self.assertIn(b'<form method="post" action="/login"', body)
        for text in FILES.values():
            self.assertNotIn(text.encode(), body)
        self.assertNotIn(b"DATA", body)
        self.assertNotIn(b"og:", body)  # no preview built: no tags

    def test_without_a_session_only_the_login_page(self):
        for path in self.PATHS:
            with self.subTest(path=path):
                status, headers, body = self.get(path)
                page = path in self.PAGES
                self.assertEqual(status, 200 if page else 401)
                self.assertTrue(headers["Content-Type"].startswith("text/html"))
                self.assertEqual(headers["Cache-Control"], "no-store")
                self.assertEqual(headers["X-Robots-Tag"], "noindex, nofollow")
                self.assertEqual(headers["X-Frame-Options"], "DENY")
                # So that the browser sends the form with its Origin (with no-referrer it would be «null», refused)
                self.assertEqual(headers.get_all("Referrer-Policy"), ["same-origin"])
                self.assert_login_page(body)
                status, _, body = self.get(path, method="HEAD")
                self.assertEqual((status, body), (200 if page else 401, b""))
        self.assertEqual(self.get("/health")[:3:2], (200, b"ok"))
        # The form goes back to the path it was shown at, never to another site
        self.assertIn(b'name="next" value="/media/abc.jpg"', self.get("/media/abc.jpg")[2])
        self.assertIn(b'name="next" value="/"', self.get("/login?next=//evil.example")[2])
        self.assertEqual(self.get("/login")[0], 200)

    def test_forged_cookies_are_worth_nothing(self):
        for cookie in ("arbre_session=1", "arbre_hint=1", "arbre_session=9999999999.00.00"):
            for path in ("/", "/private/data.json", "/media/abc.jpg"):
                with self.subTest(cookie=cookie, path=path):
                    self.assert_login_page(self.get(path, cookie)[2])

    def test_the_form_opens_everything_and_goes_back(self):
        status, headers, body = self.server.login("wrong", ip="10.3.0.1", form=True)
        self.assertEqual(status, 401)
        self.assert_login_page(body)
        self.assertIn(b'class="error"', body)
        self.assertEqual(self.server.login("wrong", ip="10.3.0.1")[:3:2], (401, b""))  # JSON: no content
        body = "password=" + PASSWORD + "&next=/media/abc.jpg%23arbol/padre"
        status, headers, _ = self.server.request("POST", "/login", body,
                                                 {"Content-Type": "application/x-www-form-urlencoded"}, "10.3.0.2")
        self.assertEqual((status, headers["Location"]), (303, "/media/abc.jpg#arbol/padre"))
        self.assertTrue(any(c.startswith("arbre_hint=1;") for c in headers.get_all("Set-Cookie")))
        cookie = session_cookie(headers)
        for path, text in (("/", "public/index.html"), ("/index.html", "public/index.html"),
                           ("/media/abc.jpg", "public/media/abc.jpg"), ("/private/data.json", "private/data.json"),
                           ("/private/media/F001/000-t.jpg", "private/media/F001/000-t.jpg"),
                           (f"/{SOURCES_DIR}/F001/acta.pdf", "sources/F001/acta.pdf")):
            with self.subTest(path=path):
                status, headers, body = self.get(path, cookie)
                self.assertEqual((status, body), (200, FILES[text].encode()))
                self.assertIn(headers["Cache-Control"], ("no-store", "private, no-cache", "private, max-age=3600"))
        self.assertEqual(self.get("/missing.html", cookie)[0], 404)
        self.assertEqual(self.get("/login?next=/media/abc.jpg", cookie)[1]["Location"], "/media/abc.jpg")
        # Another site, a header in the path or a bare host are not places to go back to
        for nxt in ("//evil.example", "https://evil.example", "/%0d%0aSet-Cookie:x=1", "/\\evil.example"):
            with self.subTest(next=nxt):
                status, headers, _ = self.server.request(
                    "POST", "/login", f"password={PASSWORD}&next={nxt}",
                    {"Content-Type": "application/x-www-form-urlencoded"}, "10.3.0.3")
                self.assertEqual((status, headers["Location"]), (303, "/"))
        # Closing the session tells the web to reload: it lands on the login page
        status, headers, _ = self.server.request("POST", "/logout")
        self.assertEqual((status, headers["X-Site-Mode"]), (204, "closed"))
        self.assertTrue(all("Max-Age=0" in c for c in headers.get_all("Set-Cookie")))

    def test_attempts_are_throttled_the_same(self):
        ip = "10.3.1.1"
        for _ in range(5):
            self.assertEqual(self.server.login("wrong", ip=ip, form=True)[0], 401)
        status, headers, body = self.server.login(ip=ip, form=True)
        self.assertEqual((status, headers.get("Set-Cookie")), (429, None))
        self.assert_login_page(body)
        self.assertEqual(self.server.login(ip=ip)[:3:2], (429, b""))


if __name__ == "__main__":
    unittest.main(verbosity=2)
