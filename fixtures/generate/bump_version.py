"""Bump the declared ExCSV format version across the repo's text files.

Rewrites only version *declarations*, never arbitrary numbers:

    #!excsv ... version=0.5      -> version=0.6   (headers, prose, generators)
    "excsv": "0.5" / excsv: '0.5' -> "0.6"         (JSON form, TS objects)
    version: "0.5"               -> "0.6"          (fixtures.yaml expectations, TS)
    v0.5                          -> v0.6           (prose, footer)
    excsv-0.5.schema.json         -> excsv-0.6.schema.json  ($id)

Values such as 250.50 or hole=0.5 are untouched. Files that intentionally
declare another version (e.g. the version=9.9 unknown_version fixture) are
untouched too, since only the exact FROM version is matched.

Binary fixtures (.zip) are skipped: regenerate them with make_zip_fixtures.py
and make_pack_fixtures.py after running this script.

Usage:
    python fixtures/generate/bump_version.py 0.5 0.6 [PATH ...] [--dry-run]

PATH defaults to fixtures/. Re-running with the same pair is NOT a no-op once a
newer version ships: files that deliberately keep the old version (the 0.5
compatibility fixture, implementation badges, the changelog) would be rewritten.
Always run it with the pair you are moving between, and review the diff.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TEXT_SUFFIXES = {
    ".excsv", ".extsv", ".csv", ".tsv", ".json", ".yaml", ".yml", ".md",
    ".py", ".ts", ".mjs", ".js", ".astro", ".html", ".txt",
}
SKIP_DIRS = {"node_modules", "dist", ".git", ".astro", ".wrangler"}


def build_patterns(old: str, new: str) -> list[tuple[re.Pattern[str], str]]:
    o = re.escape(old)
    end = r"(?![0-9]|\.[0-9])"  # 0.5 but not 0.50 / 0.5.1
    return [
        (re.compile(rf"(?<![\w.])(version=){o}{end}"), rf"\g<1>{new}"),
        (re.compile(rf"""(["']?(?:excsv|version)["']?\s*:\s*["']){o}(["'])"""), rf"\g<1>{new}\g<2>"),
        (re.compile(rf"(?<![\w.])(v){o}{end}"), rf"\g<1>{new}"),
        (re.compile(rf"(excsv-){o}(\.schema\.json)"), rf"\g<1>{new}\g<2>"),
    ]


def iter_files(paths: list[Path]):
    for base in paths:
        if base.is_file():
            yield base
            continue
        for p in base.rglob("*"):
            if p.is_file() and p.suffix in TEXT_SUFFIXES and not SKIP_DIRS.intersection(p.parts):
                yield p


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("old")
    ap.add_argument("new")
    ap.add_argument("paths", nargs="*", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    paths = [p if p.is_absolute() else Path.cwd() / p for p in args.paths] or [ROOT / "fixtures"]
    patterns = build_patterns(args.old, args.new)
    this = Path(__file__).resolve()

    changed = 0
    for path in iter_files(paths):
        if path.resolve() == this:
            continue
        # latin-1 maps every byte to one char and back, so files that aren't valid
        # UTF-8 (the invalid_utf8 fixture) are rewritten without touching other bytes.
        text = path.read_bytes().decode("latin-1")
        new_text = text
        hits = 0
        for pat, repl in patterns:
            new_text, n = pat.subn(repl, new_text)
            hits += n
        if hits:
            changed += 1
            print(f"{'would update' if args.dry_run else 'updated'} {path.relative_to(ROOT)} ({hits})")
            if not args.dry_run:
                path.write_bytes(new_text.encode("latin-1"))  # keeps BOM, CRLF, trailing newline as-is
    print(f"{changed} file(s) {'to change' if args.dry_run else 'changed'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
