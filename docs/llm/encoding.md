# Encoding

Header field: `encoding=<name>`, DEFAULT `UTF-8`. Declares the character encoding of the **data section** values.

## Bootstrapping (chicken-and-egg)

`encoding=` is declared *inside* the file, so the structural skeleton must be readable before the encoding is known. Therefore:

- The header line (`#!excsv ...`) and **all** meta lines (`#@`, `#column`, `#%`, `#csvw`, `#$`, `##`, and pack `#table`/`#fk`) MUST be representable in **ASCII**. Any non-ASCII text (e.g. a Unicode `title=`/`description=`) MUST be encoded such that the bytes remain ASCII-compatible (in practice: UTF-8, where ASCII bytes are unchanged).
- Consequently `encoding=` MUST name an **ASCII superset**: an encoding in which every ASCII character maps to its single ASCII byte (0x00–0x7F). Examples: `UTF-8` (default, recommended), `latin-1` / `ISO-8859-1`, `windows-1251` / `cp1251`, other single-byte code pages.
- `UTF-16` and `UTF-32` (and any encoding that does not preserve single-byte ASCII, e.g. EBCDIC) MUST NOT be used. Such a file cannot be bootstrapped — line 1 would not start with the ASCII bytes `#!excsv`. A parser that encounters a declared non-ASCII-compatible encoding MUST warn `encoding_not_ascii_compatible` and treat the file as undecodable (lenient: best-effort; `excsv verify`: fail).

## BOM

Writers MUST NOT emit a byte-order mark; a leading BOM would otherwise prevent line 1 from starting with `#!excsv`. For tolerance, parsers MUST ignore a leading UTF-8 BOM (`EF BB BF` / `U+FEFF`), consistent with [file-structure.md](file-structure.md).

## Scope

`encoding=` governs how **data-section bytes** are decoded into text. The header and meta lines are always ASCII regardless of `encoding=`. An unknown/unsupported (but ASCII-compatible) encoding name → warn `encoding_unsupported` and fall back to UTF-8.

## Interaction with checksum

`checksum=` is computed over the **raw bytes** of the data section (in the declared encoding), not over decoded text. See [checksum.md](checksum.md) for newline normalization (byte-level `0x0D 0x0A` → `0x0A`) and the algorithm registry.
