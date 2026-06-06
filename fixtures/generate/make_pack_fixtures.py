from __future__ import annotations

import csv
import io
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures"
PLAIN = FIXTURES / "plain" / "valid"
PACK_VALID = FIXTURES / "pack" / "valid"
PACK_INVALID = FIXTURES / "pack" / "invalid"

FIXED_DT = (2026, 1, 1, 0, 0, 0)
META_PREFIXES = ("#!", "#@", "#column", "#%", "#$", "#csvw", "##")


@dataclass
class ParsedPlain:
    header_kv: dict[str, str]
    header_line: str
    meta_lines: list[str]
    column_names: list[str]
    column_indices: list[int]
    rows: list[list[str]]


@dataclass
class TableBuild:
    name: str
    dir_name: str
    header_meta: list[str]
    header_kv_extra: dict[str, str] = field(default_factory=dict)
    columns: list[list[str]] = field(default_factory=list)
    section_size: int | None = None
    sql_dialect: str | None = None


@dataclass
class PackBuild:
    tables: list[TableBuild]
    pack_meta: list[str] = field(default_factory=list)
    single_table: str | None = None
    fks: list[str] = field(default_factory=list)
    include_manifest: bool = True
    manifest_table_lines: list[str] | None = None


def ensure_dirs() -> None:
    PACK_VALID.mkdir(parents=True, exist_ok=True)
    PACK_INVALID.mkdir(parents=True, exist_ok=True)


def parse_header_kv(line: str) -> dict[str, str]:
    if not line.startswith("#!excsv"):
        raise ValueError(f"not an excsv header: {line!r}")
    body = line[len("#!excsv") :].strip()
    out: dict[str, str] = {}
    for token in re.findall(r'(?:[^\s"]+|"[^"]*")+', body):
        if "=" not in token:
            continue
        key, value = token.split("=", 1)
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        out[key] = value
    return out


def is_meta_line(line: str) -> bool:
    if not line:
        return True
    if line.startswith("##"):
        return True
    for prefix in META_PREFIXES:
        if line.startswith(prefix):
            return True
    return False


def resolve_delim(header_kv: dict[str, str]) -> str:
    delim = header_kv.get("delim", "comma")
    if delim == "tab":
        return "\t"
    if delim == "pipe":
        return "|"
    if delim == "semicolon":
        return ";"
    if delim in {"comma", "csv"}:
        return ","
    return delim


def resolve_quotechar(header_kv: dict[str, str]) -> str | None:
    quote = header_kv.get("quote", "double")
    if quote in {"none", "off"}:
        return None
    if quote == "single":
        return "'"
    if quote == "#":
        return "#"
    return '"'


def parse_csv_row(line: str, delim: str, quotechar: str | None) -> list[str]:
    if quotechar is None:
        return line.split(delim)
    return next(csv.reader(io.StringIO(line), delimiter=delim, quotechar=quotechar))


def parse_plain(relative: str) -> ParsedPlain:
    text = (FIXTURES / relative).read_text(encoding="utf-8")
    if text.startswith("\ufeff"):
        text = text[1:]
    lines = text.splitlines()
    header_line = lines[0]
    header_kv = parse_header_kv(header_line)
    meta_lines: list[str] = []
    data_lines: list[str] = []
    in_meta = True
    for line in lines[1:]:
        if in_meta and is_meta_line(line):
            meta_lines.append(line)
            continue
        in_meta = False
        if line or data_lines:
            data_lines.append(line)

    column_names: list[str] = []
    column_indices: list[int] = []
    for line in meta_lines:
        if not line.startswith("#column"):
            continue
        attrs = line[len("#column") :].strip()
        name_m = re.search(r'\bname=([^\s"]+|"[^"]*")', attrs)
        index_m = re.search(r"\bindex=(\d+)", attrs)
        if name_m:
            name = name_m.group(1)
            if name.startswith('"') and name.endswith('"'):
                name = name[1:-1]
            column_names.append(name)
        if index_m:
            column_indices.append(int(index_m.group(1)))

    delim = resolve_delim(header_kv)
    quotechar = resolve_quotechar(header_kv)
    header_mode = header_kv.get("header", "1")
    rows_raw = [parse_csv_row(line, delim, quotechar) for line in data_lines]
    if header_mode != "0" and rows_raw:
        rows_raw = rows_raw[1:]

    if not column_names and rows_raw:
        column_names = [f"col{i}" for i in range(len(rows_raw[0]))]
    if not column_indices:
        column_indices = list(range(len(column_names)))

    return ParsedPlain(
        header_kv=header_kv,
        header_line=header_line,
        meta_lines=meta_lines,
        column_names=column_names,
        column_indices=column_indices,
        rows=rows_raw,
    )


def plain_to_table(name: str, relative: str, section_size: int | None = None) -> TableBuild:
    parsed = parse_plain(relative)
    columns = len(parsed.column_names)
    col_data: list[list[str]] = [[] for _ in range(columns)]
    for row in parsed.rows:
        padded = row + [""] * (columns - len(row))
        for i in range(columns):
            col_data[i].append(padded[i])

    meta = [line for line in parsed.meta_lines if not line.startswith("#!")]
    extra: dict[str, str] = {}
    if parsed.header_kv.get("sql-dialect"):
        extra["sql-dialect"] = parsed.header_kv["sql-dialect"]
    if parsed.header_kv.get("null") is not None:
        extra["null"] = parsed.header_kv["null"]

    return TableBuild(
        name=name,
        dir_name=f"{name}/",
        header_meta=meta,
        header_kv_extra=extra,
        columns=col_data,
        section_size=section_size,
        sql_dialect=parsed.header_kv.get("sql-dialect"),
    )


def manual_table(
    name: str,
    header_meta: list[str],
    columns: list[tuple[str, list[str]]],
    section_size: int | None = None,
    sql_dialect: str | None = None,
) -> TableBuild:
    return TableBuild(
        name=name,
        dir_name=f"{name}/",
        header_meta=header_meta,
        header_kv_extra={"sql-dialect": sql_dialect} if sql_dialect else {},
        columns=[values for _, values in columns],
        section_size=section_size,
        sql_dialect=sql_dialect,
    )


def section_starts(rows: int, section_size: int) -> list[int]:
    starts: list[int] = []
    start = 0
    while start < rows:
        starts.append(start)
        start += section_size
    return starts


def section_pad_width(rows: int) -> int:
    return max(1, len(str(max(rows - 1, 0))))


def safe_col_filename(index: int, name: str, header0: bool) -> str:
    safe = re.sub(r"[^a-z0-9_]+", "_", name.lower()).strip("_") or "col"
    if header0:
        return f"{index:02d}.col"
    return f"{index:02d}-{safe}.col"


def col_payload(values: list[str]) -> bytes:
    return ("\n".join(values) + "\n").encode("utf-8")


def table_header_text(table: TableBuild) -> str:
    rows = len(table.columns[0]) if table.columns else 0
    parts = ["#!excsv version=0.3 layout=columnar", f"rows={rows}"]
    if table.section_size:
        parts.append(f"section-size={table.section_size}")
    for key, value in table.header_kv_extra.items():
        if value == "":
            parts.append(f'{key}=""')
        else:
            parts.append(f"{key}={value}")
    header = " ".join(parts)
    body = table.header_meta
    if body:
        return header + "\n" + "\n".join(body) + "\n"
    return header + "\n"


def table_entries(table: TableBuild) -> tuple[list[tuple[str, bytes]], int]:
    entries: list[tuple[str, bytes]] = []
    payload_size = 0
    header0 = any("index=" in line for line in table.header_meta) and not any(
        "name=" in line for line in table.header_meta if line.startswith("#column")
    )
    names = []
    for line in table.header_meta:
        if not line.startswith("#column"):
            continue
        name_m = re.search(r'\bname=([^\s"]+|"[^"]*")', line)
        if name_m:
            n = name_m.group(1)
            if n.startswith('"') and n.endswith('"'):
                n = n[1:-1]
            names.append(n)
    if not names:
        names = [f"col{i}" for i in range(len(table.columns))]

    header_bytes = table_header_text(table).encode("utf-8")
    entries.append((f"{table.dir_name}_header.excsv", header_bytes))

    rows = len(table.columns[0]) if table.columns else 0
    if table.section_size and table.section_size > 0 and rows > 0:
        width = section_pad_width(rows)
        for idx, (name, values) in enumerate(zip(names, table.columns)):
            folder = f"{table.dir_name}{idx:02d}-{re.sub(r'[^a-z0-9_]+', '_', name.lower()).strip('_') or 'col'}/"
            for start in section_starts(rows, table.section_size):
                chunk = values[start : start + table.section_size]
                rel = f"{folder}{start:0{width}d}.col"
                payload = col_payload(chunk)
                entries.append((rel, payload))
                payload_size += len(payload)
    else:
        for idx, (name, values) in enumerate(zip(names, table.columns)):
            rel = f"{table.dir_name}{safe_col_filename(idx, name, header0)}"
            payload = col_payload(values)
            entries.append((rel, payload))
            payload_size += len(payload)

    return entries, payload_size


def manifest_text(spec: PackBuild, table_payload_sizes: list[int]) -> str:
    table_count = len(spec.tables)
    original_size = sum(table_payload_sizes)
    parts = [
        "#!excsv version=0.3 layout=pack",
        f"table-count={table_count}",
        f"original-size={original_size}",
    ]
    if spec.single_table and table_count == 1:
        parts.insert(2, f"single-table={spec.single_table}")
    header = " ".join(parts)
    lines = [header, *spec.pack_meta]
    if spec.manifest_table_lines is not None:
        lines.extend(spec.manifest_table_lines)
    else:
        for table, payload_size in zip(spec.tables, table_payload_sizes):
            col_count = len(table.columns)
            lines.append(
                f"#table name={table.name} dir={table.dir_name} columns={col_count} original-size={payload_size}"
            )
    lines.extend(spec.fks)
    return "\n".join(lines) + "\n"


def manifest_comment(manifest: str) -> bytes:
    out: list[str] = []
    for line in manifest.splitlines():
        if not line:
            continue
        if line.startswith("#"):
            out.append(line)
            continue
        break
    return "\n".join(out).encode("utf-8")


def zip_info(name: str) -> zipfile.ZipInfo:
    zi = zipfile.ZipInfo(filename=name, date_time=FIXED_DT)
    zi.compress_type = zipfile.ZIP_DEFLATED
    return zi


def write_pack(path: Path, entries: list[tuple[str, bytes]], comment: bytes) -> None:
    ordered = sorted(entries, key=lambda item: (0 if item[0] == "_manifest.excsv" else 1, item[0]))
    with zipfile.ZipFile(path, "w") as zf:
        for name, payload in ordered:
            zf.writestr(zip_info(name), payload)
        zf.comment = comment


def build_pack(path: Path, spec: PackBuild) -> None:
    all_entries: list[tuple[str, bytes]] = []
    payload_sizes: list[int] = []
    for table in spec.tables:
        entries, payload_size = table_entries(table)
        all_entries.extend(entries)
        payload_sizes.append(payload_size)

    if spec.include_manifest:
        manifest = manifest_text(spec, payload_sizes)
        all_entries.insert(0, ("_manifest.excsv", manifest.encode("utf-8")))
        comment = manifest_comment(manifest)
    else:
        comment = b""

    write_pack(path, all_entries, comment)


def make_valid() -> None:
    contacts = plain_to_table("contacts", "plain/valid/009_column_minimal.excsv")
    contacts.name = "contacts"
    contacts.dir_name = "contacts/"
    contacts.header_meta = [
        "#@source: fixtures.contacts",
        "#column name=id type=int",
        "#column name=email type=string",
    ]

    build_pack(
        PACK_VALID / "001_single_table_unsectioned.excsv.pack.zip",
        PackBuild(
            tables=[contacts],
            single_table="contacts",
            pack_meta=["#@pack-name: contacts-only"],
        ),
    )

    build_pack(
        PACK_VALID / "002_empty_pack.excsv.pack.zip",
        PackBuild(tables=[], pack_meta=["#@pack-name: empty"]),
    )

    customers = manual_table(
        "customers",
        [
            "#@source: fixtures.customers",
            "#column name=id type=int unique=1",
            "#column name=name type=string",
        ],
        [
            ("id", ["1", "2"]),
            ("name", ["Amy", "Bob"]),
        ],
    )
    orders = manual_table(
        "orders",
        [
            "#@source: fixtures.orders",
            "#column name=id type=int unique=1",
            "#column name=customer_id type=int",
            "#column name=amount type=decimal unit=USD",
        ],
        [
            ("id", ["10", "11", "12"]),
            ("customer_id", ["1", "2", "1"]),
            ("amount", ["10.00", "20.00", "15.50"]),
        ],
    )

    build_pack(
        PACK_VALID / "003_two_tables_no_fk.excsv.pack.zip",
        PackBuild(
            tables=[customers, orders],
            pack_meta=["#@pack-name: sales-mini"],
        ),
    )

    build_pack(
        PACK_VALID / "004_two_tables_with_fk.excsv.pack.zip",
        PackBuild(
            tables=[customers, orders],
            pack_meta=["#@pack-name: sales-with-fk"],
            fks=["#fk from=orders.customer_id to=customers.id"],
        ),
    )

    build_pack(
        PACK_VALID / "005_pack_provenance.excsv.pack.zip",
        PackBuild(
            tables=[customers],
            single_table="customers",
            pack_meta=[
                "#@pack-name: provenance-demo",
                "#@author: ops@example.com",
                "#@created: 2026-01-01T00:00:00Z",
                "#@source: warehouse-snapshot",
            ],
        ),
    )

    mysql_table = manual_table(
        "orders_mysql",
        [
            "#@source: sales_db.orders",
            "#$ddl: CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, amount DECIMAL(8,2)) ENGINE=InnoDB",
            "#column name=id type=int",
            "#column name=amount type=decimal",
        ],
        [("id", ["1", "2"]), ("amount", ["10.00", "20.50"])],
        sql_dialect="mysql",
    )
    pg_table = manual_table(
        "orders_pg",
        [
            "#@source: analytics.orders",
            "#$ddl-postgres-15: CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, amount NUMERIC(8,2))",
            "#column name=id type=int",
            "#column name=amount type=decimal",
        ],
        [("id", ["1", "2"]), ("amount", ["10.00", "20.50"])],
        sql_dialect="postgres-15",
    )
    build_pack(
        PACK_VALID / "006_tables_different_sql_dialects.excsv.pack.zip",
        PackBuild(
            tables=[mysql_table, pg_table],
            pack_meta=["#@pack-name: dialect-mix"],
        ),
    )

    sectioned = manual_table(
        "metrics",
        [
            "#@source: fixtures.metrics",
            "#column name=id type=int",
            "#column name=name type=string",
            "#column name=amount type=decimal",
            "#%count_nonnull: 5,5,5",
            "#%sum: ,,125.00",
        ],
        [
            ("id", ["1", "2", "3", "4", "5"]),
            ("name", ["Amy", "Bob", "Clara", "Dan", "Eve"]),
            ("amount", ["10.00", "20.00", "30.00", "40.00", "25.00"]),
        ],
        section_size=2,
    )
    build_pack(
        PACK_VALID / "007_sectioned_table.excsv.pack.zip",
        PackBuild(
            tables=[sectioned],
            single_table="metrics",
            pack_meta=["#@pack-name: sectioned-single"],
        ),
    )

    flat = plain_to_table("contacts", "plain/valid/009_column_minimal.excsv")
    flat.name = "contacts"
    flat.dir_name = "contacts/"
    flat.header_meta = [
        "#@source: fixtures.contacts",
        "#column name=id type=int",
        "#column name=email type=string",
    ]
    build_pack(
        PACK_VALID / "008_mixed_sectioned_unsectioned.excsv.pack.zip",
        PackBuild(
            tables=[sectioned, flat],
            pack_meta=["#@pack-name: mixed-layout"],
        ),
    )

    build_pack(
        PACK_VALID / "009_auto_discovery_empty_table_lines.excsv.pack.zip",
        PackBuild(
            tables=[customers, orders],
            pack_meta=["#@pack-name: auto-discovery"],
            manifest_table_lines=[],
        ),
    )

    # No _manifest.excsv — reader discovers tables alphabetically.
    entries: list[tuple[str, bytes]] = []
    payload_sizes: list[int] = []
    for table in [customers, orders]:
        table_entries_list, payload_size = table_entries(table)
        entries.extend(table_entries_list)
        payload_sizes.append(payload_size)
    write_pack(
        PACK_VALID / "010_auto_discovery_no_manifest.excsv.pack.zip",
        entries,
        b"",
    )


def corrupt_entry(entries: list[tuple[str, bytes]], name: str, payload: bytes) -> list[tuple[str, bytes]]:
    return [(n, payload if n == name else p) for n, p in entries]


def make_invalid() -> None:
    base_table = manual_table(
        "items",
        ["#column name=id type=int", "#column name=name type=string"],
        [("id", ["1"]), ("name", ["A"])],
    )
    entries, payload_size = table_entries(base_table)
    manifest_ok = manifest_text(PackBuild(tables=[base_table]), [payload_size])

    bad_layout = manifest_ok.replace(" layout=pack", "", 1)
    write_pack(
        PACK_INVALID / "001_manifest_missing_layout.excsv.pack.zip",
        [("_manifest.excsv", bad_layout.encode("utf-8")), *entries],
        manifest_comment(bad_layout),
    )

    missing_dir_manifest = manifest_text(
        PackBuild(
            tables=[base_table],
            manifest_table_lines=[
                "#table name=items dir=missing/ columns=2 original-size=999"
            ],
        ),
        [payload_size],
    )
    write_pack(
        PACK_INVALID / "002_table_dir_missing.excsv.pack.zip",
        [("_manifest.excsv", missing_dir_manifest.encode("utf-8")), *entries],
        manifest_comment(missing_dir_manifest),
    )

    no_header_entries = [e for e in entries if not e[0].endswith("_header.excsv")]
    manifest = manifest_text(PackBuild(tables=[base_table]), [payload_size])
    write_pack(
        PACK_INVALID / "003_table_header_missing.excsv.pack.zip",
        [("_manifest.excsv", manifest.encode("utf-8")), *no_header_entries],
        manifest_comment(manifest),
    )

    extra_col = entries + [("items/02-extra.col", b"99\n")]
    manifest = manifest_text(PackBuild(tables=[base_table]), [payload_size])
    write_pack(
        PACK_INVALID / "004_column_count_mismatch.excsv.pack.zip",
        [("_manifest.excsv", manifest.encode("utf-8")), *extra_col],
        manifest_comment(manifest),
    )

    bad_col = corrupt_entry(entries, "items/00-id.col", b"1\n2\n")
    manifest = manifest_text(PackBuild(tables=[base_table]), [payload_size])
    write_pack(
        PACK_INVALID / "005_col_line_count_mismatch.excsv.pack.zip",
        [("_manifest.excsv", manifest.encode("utf-8")), *bad_col],
        manifest_comment(manifest),
    )

    sectioned = manual_table(
        "items",
        ["#column name=id type=int", "#column name=name type=string"],
        [("id", ["1", "2", "3", "4", "5"]), ("name", ["a", "b", "c", "d", "e"])],
        section_size=2,
    )
    sec_entries, sec_payload = table_entries(sectioned)
    sec_entries = corrupt_entry(sec_entries, "items/00-id/04.col", b"5\n6\n")
    manifest = manifest_text(PackBuild(tables=[sectioned]), [sec_payload])
    write_pack(
        PACK_INVALID / "006_section_partition_error.excsv.pack.zip",
        [("_manifest.excsv", manifest.encode("utf-8")), *sec_entries],
        manifest_comment(manifest),
    )

    sec_entries, sec_payload = table_entries(sectioned)
    sec_entries = corrupt_entry(sec_entries, "items/01-name/02.col", b"c\n")
    manifest = manifest_text(PackBuild(tables=[sectioned]), [sec_payload])
    write_pack(
        PACK_INVALID / "007_section_boundary_mismatch.excsv.pack.zip",
        [("_manifest.excsv", manifest.encode("utf-8")), *sec_entries],
        manifest_comment(manifest),
    )


def main() -> None:
    ensure_dirs()
    make_valid()
    make_invalid()
    print("Generated pack fixtures in fixtures/pack/{valid,invalid}")


if __name__ == "__main__":
    main()
