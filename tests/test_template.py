#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""The protection of the public template, on scratch git repositories in a temporary folder: a copy of the engine's
files (scripts/template_paths.txt) with a fictional family. scripts/check_template.py: a clean engine passes, a name
of the family in an engine file fails and a common word does not, a file that is neither the engine's nor the family's
fails, and --rev checks a commit instead of the working tree, and the messages of the commits it brings (no name of
the family, no «(cherry picked from commit …)»). scripts/hooks/pre-push, installed in the scratch repository and run
by real pushes to bare repositories: a clean template reaches the remote `github`; a name in the engine or in a commit
message, a cherry-pick -x line, or a commit touching the family's files does not; other remotes skip the checks; and
the hook that was there before (pre-push.local) runs after them, with the same arguments and refs.

The copy leaves out this file, which carries the fictional names on purpose. The scratch repositories ignore the
user's git configuration (GIT_CONFIG_GLOBAL), so that no global hook or filter takes part.

Usage: uv run tests/test_template.py
"""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

CODE = Path(__file__).resolve().parent.parent
ENGINE_LIST = CODE / "scripts" / "template_paths.txt"
HOOK = CODE / "scripts" / "hooks" / "pre-push"
ENV = {**{k: v for k, v in os.environ.items() if k != "ARBRE_ROOT"},
       "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
       "GIT_AUTHOR_NAME": "Test", "GIT_AUTHOR_EMAIL": "test@example.com",
       "GIT_COMMITTER_NAME": "Test", "GIT_COMMITTER_EMAIL": "test@example.com"}

# A fictional family whose names appear nowhere in the engine (only in this file, which is not copied)
CONFIG = """\
paths:
  people: {people}
main: eulalia-brugarolas-quintanilla
families:
  - {{key: brugarolas, label: Casa Brugarolas, title: Casa Brugarolas, of: de la casa Brugarolas, default: true}}
branches:
  - {{key: brugarolas, label: Brugarolas, color: "#2a78d6", founder: ramon-brugarolas-ferriol, family: brugarolas}}
other_branch: {{key: otras, label: Otras familias, color: "#9a958c"}}
groups:
  - {{family: brugarolas, title: Brugarolas, branches: [brugarolas]}}
"""
PEOPLE = {
    "ramon-brugarolas-ferriol": ("Ramon", "Brugarolas Ferriol"),
    "eulalia-brugarolas-quintanilla": ("Eulàlia", "Brugarolas Quintanilla"),
    # «Nieto» is in the exceptions of check_template.py (a common word)
    "pilar-nieto-brugarolas": ("Pilar", "Nieto Brugarolas"),
}


def git(repo, *args, check=True):
    return subprocess.run(["git", *args], cwd=repo, env=ENV, check=check, capture_output=True, text=True)


def engine_files():
    """The engine's tracked files, as scripts/template_paths.txt lists them."""
    entries = [x.strip().rstrip("/") for x in ENGINE_LIST.read_text(encoding="utf-8").splitlines()
               if x.strip() and not x.startswith("#")]
    tracked = subprocess.run(["git", "ls-files", "-z"], cwd=CODE, check=True, capture_output=True,
                             text=True).stdout.split("\0")
    return [p for p in tracked if p and any(p == e or p.startswith(e + "/") for e in entries)
            and p != "tests/test_template.py"]


def copy_engine(dest):
    for path in engine_files():
        src, dst = CODE / path, dest / path
        if not src.exists() and not src.is_symlink():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst, follow_symlinks=False)


def write_family(root, people="people"):
    (root / "families.yml").write_text(CONFIG.format(people=people), encoding="utf-8")
    (root / people).mkdir(exist_ok=True)
    for slug, (given, surnames) in PEOPLE.items():
        (root / people / f"{slug}.md").write_text(
            f"---\ngiven_name: {given}\nsurnames: {surnames}\nsex: U\n---\n# {given} {surnames}\n", encoding="utf-8")


def init_repo(path):
    path.mkdir(parents=True)
    git(path, "init", "-q", "-b", "main")
    return path


def commit(repo, message):
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "--allow-empty", "-m", message)
    return git(repo, "rev-parse", "HEAD").stdout.strip()


class CheckTemplate(unittest.TestCase):
    """check_template.py of the scratch copy, on its own fictional family."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.repo = init_repo(Path(cls.tmp.name) / "tree")
        copy_engine(cls.repo)
        write_family(cls.repo)
        cls.clean = commit(cls.repo, "engine and a fictional family")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def tearDown(self):
        git(self.repo, "reset", "-q", "--hard", self.clean)
        git(self.repo, "clean", "-q", "-fdx")

    def check(self, *args):
        return subprocess.run(["uv", "run", "--quiet", "scripts/check_template.py", *args], cwd=self.repo, env=ENV,
                              capture_output=True, text=True)

    def plant(self, text, path="web/src/notes.md"):
        (self.repo / path).parent.mkdir(parents=True, exist_ok=True)
        (self.repo / path).write_text(text + "\n", encoding="utf-8")

    def test_a_clean_engine_passes(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("0 names, 0 unclassified files", result.stdout)

    def test_a_name_of_the_family_fails(self):
        self.plant("Una carta de EULALIA brugarolas, sin acentos ni mayúsculas.")
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("NAME: web/src/notes.md:1: «eulalia brugarolas» — name of eulalia-brugarolas-quintanilla",
                      result.stderr)

    def test_an_uncommon_surname_alone_fails(self):
        self.plant("// the Quintanilla case", path="scripts/extra.py")
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("«quintanilla» — surname of eulalia-brugarolas-quintanilla", result.stderr)

    def test_the_family_label_fails(self):
        self.plant("Árbol de la casa Brugarolas")
        self.assertIn("«casa brugarolas» — family brugarolas", self.check().stderr)

    def test_a_common_word_passes(self):
        self.plant("El nieto de la persona enfocada")
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_the_family_files_are_not_searched(self):
        (self.repo / "TREE.md").write_text("# La casa Brugarolas\n", encoding="utf-8")
        (self.repo / "places.yml").write_text('"Casa de Eulàlia Brugarolas": {}\n', encoding="utf-8")
        self.assertEqual(self.check().returncode, 0)

    def test_an_unclassified_file_fails(self):
        (self.repo / "notes.txt").write_text("nothing\n", encoding="utf-8")
        result = self.check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("UNCLASSIFIED: notes.txt", result.stderr)

    def test_rev_checks_a_commit_not_the_working_tree(self):
        self.plant("Ramon Brugarolas")
        planted = commit(self.repo, "a name in the engine")
        (self.repo / "web/src/notes.md").unlink()  # the working tree is clean again; the commit is not
        self.assertEqual(self.check().returncode, 0)
        result = self.check("--rev", planted)
        self.assertEqual(result.returncode, 1)
        self.assertIn("«ramon brugarolas» — name of ramon-brugarolas-ferriol", result.stderr)
        self.assertEqual(self.check("--rev", self.clean).returncode, 0)

    def test_rev_checks_the_commit_messages(self):
        commit(self.repo, "Fix the fan chart\n\nAs Eulàlia Brugarolas noticed.")
        result = self.check("--rev", "HEAD")
        self.assertEqual(result.returncode, 1)
        self.assertIn("«eulalia brugarolas» — name of eulalia-brugarolas-quintanilla", result.stderr)
        self.assertIn("0 names, 0 unclassified files, 2 in commit messages", result.stdout)  # full name and surname

    def test_rev_refuses_the_cherry_pick_line(self):
        commit(self.repo, "Fix the fan chart\n\n(cherry picked from commit 0123456789abcdef0123456789abcdef01234567)")
        result = self.check("--rev", "HEAD")
        self.assertEqual(result.returncode, 1)
        self.assertIn("«(cherry picked from commit» — hash of a private commit", result.stderr)

    def test_rev_with_remote_checks_only_the_new_messages(self):
        named = commit(self.repo, "Notes of Ramon Brugarolas")
        git(self.repo, "update-ref", "refs/remotes/github/main", named)  # the remote already has it
        try:
            commit(self.repo, "Fix the fan chart")
            self.assertEqual(self.check("--rev", "HEAD", "--remote", "github").returncode, 0)
            self.assertEqual(self.check("--rev", "HEAD").returncode, 1)
        finally:
            git(self.repo, "update-ref", "-d", "refs/remotes/github/main")

    def test_family_paths(self):
        result = self.check("--family-paths")
        self.assertEqual(result.stdout.split(), ["families.yml", "places.yml", "TREE.md", ".obsidian/graph.json",
                                                 "people/", "sources/", "research/", "portraits/"])


# What the hook says when check_template.py refuses a ref
IN_NAMES = "has names of the family in its engine files or commit messages"


class PrePush(unittest.TestCase):
    """The pre-push hook in a template repository (the engine and the empty default data folders) with a second
    worktree holding the family's tree, as the family's repository keeps its template branch. The family's people
    folder has another name (`gente`), so the hook must read it from its families.yml."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        base = Path(cls.tmp.name)
        cls.repo = init_repo(base / "template")
        copy_engine(cls.repo)
        for folder in ("people", "sources", "research", "portraits"):
            (cls.repo / folder).mkdir()
            (cls.repo / folder / ".gitkeep").touch()
        cls.clean = commit(cls.repo, "Initial commit")
        git(cls.repo, "worktree", "add", "-q", "-b", "family", str(base / "family"))
        write_family(base / "family", people="gente")
        hooks = Path(git(cls.repo, "rev-parse", "--path-format=absolute", "--git-path", "hooks").stdout.strip())
        hooks.mkdir(exist_ok=True)
        shutil.copy2(HOOK, hooks / "pre-push")
        # The hook that was there before: it records how it was called (and stands in for Git LFS)
        cls.log = base / "local-hook.log"
        (hooks / "pre-push.local").write_text(f'#!/bin/sh\n{{ echo "args: $*"; cat; }} >> "{cls.log}"\n',
                                              encoding="utf-8")
        (hooks / "pre-push.local").chmod(0o755)
        for remote in ("github", "kit", "home"):
            git(base, "init", "-q", "--bare", f"{remote}.git")
            git(cls.repo, "remote", "add", remote, str(base / f"{remote}.git"))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def setUp(self):
        git(self.repo, "checkout", "-q", "-B", "work", self.clean)
        self.log.unlink(missing_ok=True)

    def push(self, remote, branch):
        return git(self.repo, "push", remote, f"HEAD:refs/heads/{branch}", check=False)

    def remote_has(self, remote, branch):
        return bool(git(self.repo, "ls-remote", remote, f"refs/heads/{branch}").stdout.strip())

    def local_hook_calls(self):
        return self.log.read_text(encoding="utf-8") if self.log.exists() else ""

    def change(self, path, text="x\n"):
        (self.repo / path).parent.mkdir(parents=True, exist_ok=True)
        (self.repo / path).write_text(text, encoding="utf-8")
        return commit(self.repo, f"touch {path}")

    def assert_refused(self, result, message):
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertEqual(self.local_hook_calls(), "")

    def test_a_clean_template_is_pushed_and_the_previous_hook_runs(self):
        result = self.push("github", "clean")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.remote_has("github", "clean"))
        calls = self.local_hook_calls()
        self.assertIn(f"args: github {self.tmp.name}/github.git", calls)
        self.assertIn(f"HEAD {self.clean} refs/heads/clean ", calls)

    def test_a_name_in_the_engine_is_refused(self):
        self.change("web/src/about.md", "Hecho con los papeles de Eulàlia Brugarolas\n")
        self.assert_refused(self.push("github", "named"), IN_NAMES)
        self.assertFalse(self.remote_has("github", "named"))

    def test_a_name_in_a_commit_message_is_refused(self):
        self.change("web/src/about.md", "About the fan chart\n")
        git(self.repo, "commit", "-q", "--amend", "-m", "Fix the fan chart\n\nThe Quintanilla branch looked wrong.")
        self.assert_refused(self.push("github", "message"), IN_NAMES)
        self.assertFalse(self.remote_has("github", "message"))

    def test_a_cherry_pick_line_is_refused(self):
        self.change("web/src/about.md", "About the fan chart\n")
        git(self.repo, "commit", "-q", "--amend", "-m",
            "Fix the fan chart\n\n(cherry picked from commit 0123456789abcdef0123456789abcdef01234567)")
        self.assert_refused(self.push("github", "picked"), IN_NAMES)
        self.assertFalse(self.remote_has("github", "picked"))

    def test_the_family_files_are_refused(self):
        for path in ("families.yml", "places.yml", "TREE.md", "gente/nueva.md"):
            with self.subTest(path=path):
                self.setUp()
                self.change(path)
                branch = "data-" + path.replace("/", "-")
                self.assert_refused(self.push("github", branch), "has commits that touch the family's data")
                self.assertFalse(self.remote_has("github", branch))

    def test_the_kit_remote_is_checked_too(self):
        # `kit`: the template a tree was cloned from, which only brings updates
        self.change("families.yml")
        self.assert_refused(self.push("kit", "tree"), "has commits that touch the family's data")
        self.assertFalse(self.remote_has("kit", "tree"))

    def test_data_anywhere_in_the_history_is_refused(self):
        self.change("places.yml")
        git(self.repo, "rm", "-q", "places.yml")
        commit(self.repo, "remove it again")
        self.assert_refused(self.push("github", "history"), "has commits that touch the family's data")

    def test_other_remotes_skip_the_checks(self):
        sha = self.change("families.yml")
        result = self.push("home", "family-data")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.remote_has("home", "family-data"))
        calls = self.local_hook_calls()
        self.assertIn(f"args: home {self.tmp.name}/home.git", calls)
        self.assertIn(f"HEAD {sha} refs/heads/family-data ", calls)

    def test_a_deletion_is_not_checked(self):
        self.assertEqual(self.push("github", "gone").returncode, 0)
        self.change("families.yml")  # the local branch now has data, but a deletion sends nothing of it
        result = git(self.repo, "push", "github", ":refs/heads/gone", check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.remote_has("github", "gone"))


if __name__ == "__main__":
    if not shutil.which("uv"):
        raise SystemExit("uv is needed to run the scripts")
    unittest.main(verbosity=2)
