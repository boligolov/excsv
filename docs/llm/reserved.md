# Pack-only keys (plain / row-ZIP)

Pack archives use `layout=pack`, `#table`, `#fk`, etc. — see [pack.md](pack.md).

Plain `.excsv` / `.extsv` and row `.excsv.zip` / `.extsv.zip` **MUST NOT** use `layout=`, `#table`, or `#fk`.

Readers encountering pack-only keys on non-pack files: ignore per [header.md](header.md) and [meta-lines.md](meta-lines.md).
