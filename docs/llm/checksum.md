# Checksum

Header field: `checksum=<algorithm>:<hex-digest>`. Scope: entire data section (after last meta line), including the header row if `header=1` and the trailing newline if present.

The digest is computed over the **raw bytes** of the data section (in the file's declared `encoding=`), not over decoded text. Newlines are normalized at the byte level before hashing: every `0x0D 0x0A` (CRLF) sequence becomes `0x0A` (LF). No other byte is altered. See [encoding.md](encoding.md).

## Algorithm registry

`<algorithm>` is a lowercase token from the table below. `<hex-digest>` MUST be lowercase hexadecimal, with length matching the algorithm's digest size.

| Algorithm | Support | Hex length |
| --- | --- | --- |
| `sha256` | MUST | 64 |
| `sha512` | MAY | 128 |
| `blake3` | MAY | 64 |

- `sha256` is the default and the only algorithm every implementation MUST support. A writer SHOULD emit `sha256` unless it has a reason to do otherwise.
- An unknown or unsupported `<algorithm>` MUST NOT be a parse failure: warn `checksum_unknown_algorithm` and skip verification (treat as no checksum present).
- A digest of wrong length or containing non-hex / uppercase characters for a known algorithm is a malformed value: warn `checksum_malformed` and skip verification (a malformed digest cannot be verified). Never fatal.
- **Verification severity — warn everywhere, never fail.** A checksum mismatch is ALWAYS a warning (`checksum_mismatch`; sidecar pair: `sidecar_checksum_mismatch`), in every mode including `excsv verify`. The format flags the discrepancy loudly but MUST NOT block execution — slices, previews, and hand-edited files stay usable. This is deliberate: `checksum=` is an advisory integrity signal, not an access gate. (`rows=` and `original-size=` mismatches have their own, stricter rules — see header.md / zip.md.)
