from __future__ import annotations

import re
import struct
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures"
PLAIN = FIXTURES / "plain" / "valid"
ZIP_VALID = FIXTURES / "zip" / "valid"
ZIP_INVALID = FIXTURES / "zip" / "invalid"

FIXED_DT = (2026, 1, 1, 0, 0, 0)


def ensure_dirs() -> None:
    ZIP_VALID.mkdir(parents=True, exist_ok=True)
    ZIP_INVALID.mkdir(parents=True, exist_ok=True)
    for folder in (ZIP_VALID, ZIP_INVALID):
        for stale in folder.glob("*.zip"):
            stale.unlink()


def load_plain(relative: str) -> list[str]:
    text = (FIXTURES / relative).read_text(encoding="utf-8")
    if text.startswith("\ufeff"):
        text = text[1:]
    return text.splitlines()


def remove_original_size(header: str) -> str:
    return re.sub(r"\s+original-size=\d+", "", header).strip()


def with_original_size(lines: list[str]) -> str:
    header = remove_original_size(lines[0])
    tail = lines[1:]
    n = 0
    while True:
        h = f"{header} original-size={n}"
        text = "\n".join([h, *tail]) + "\n"
        new_n = len(text.encode("utf-8"))
        if new_n == n:
            return text
        n = new_n


def raw_text(lines: list[str]) -> str:
    return "\n".join(lines) + "\n"


def to_comment_full(inner_text: str) -> str:
    out: list[str] = []
    for line in inner_text.splitlines():
        if not line:
            continue
        if line.startswith("#!"):
            out.append(line)
            continue
        if line.startswith("#"):
            out.append(line)
            continue
        break
    return "\n".join(out)


def to_comment_truncated(inner_text: str) -> str:
    full = to_comment_full(inner_text).splitlines()
    keep = full[:3] + ["#@comment-truncated: 1"]
    return "\n".join(keep)


def zip_info(name: str, compress_type: int) -> zipfile.ZipInfo:
    zi = zipfile.ZipInfo(filename=name, date_time=FIXED_DT)
    zi.compress_type = compress_type
    return zi


def write_zip(
    zip_path: Path,
    entries: list[tuple[str, bytes, int]],
    comment: bytes,
) -> None:
    with zipfile.ZipFile(zip_path, "w") as zf:
        for name, payload, method in entries:
            zf.writestr(zip_info(name, method), payload)
        zf.comment = comment


def patch_encrypted_flag(zip_path: Path) -> None:
    data = bytearray(zip_path.read_bytes())

    local_sig = b"PK\x03\x04"
    idx = data.find(local_sig)
    if idx != -1:
        flags = struct.unpack("<H", data[idx + 6 : idx + 8])[0]
        data[idx + 6 : idx + 8] = struct.pack("<H", flags | 0x1)

    cd_sig = b"PK\x01\x02"
    start = 0
    while True:
        cidx = data.find(cd_sig, start)
        if cidx == -1:
            break
        flags = struct.unpack("<H", data[cidx + 8 : cidx + 10])[0]
        data[cidx + 8 : cidx + 10] = struct.pack("<H", flags | 0x1)
        start = cidx + 4

    zip_path.write_bytes(bytes(data))


def patch_primary_method(zip_path: Path, new_method: int) -> None:
    data = bytearray(zip_path.read_bytes())

    local_sig = b"PK\x03\x04"
    idx = data.find(local_sig)
    if idx != -1:
        data[idx + 8 : idx + 10] = struct.pack("<H", new_method)

    cd_sig = b"PK\x01\x02"
    start = 0
    while True:
        cidx = data.find(cd_sig, start)
        if cidx == -1:
            break
        data[cidx + 10 : cidx + 12] = struct.pack("<H", new_method)
        start = cidx + 4

    zip_path.write_bytes(bytes(data))


def inner_from_plain(relative: str) -> str:
    return with_original_size(load_plain(relative))


def make_valid() -> None:
    canonical = inner_from_plain("plain/valid/020_canonical_full_small.excsv")
    unicode_inner = inner_from_plain("plain/valid/016_unicode_data.excsv")
    header0_inner = inner_from_plain("plain/valid/006_header0_with_index_columns.excsv")

    comment_full = to_comment_full(canonical).encode("utf-8")
    comment_trunc = to_comment_truncated(canonical).encode("utf-8")

    write_zip(
        ZIP_VALID / "001_simple_primary_match.excsv.zip",
        [("001_simple_primary_match.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        comment_full,
    )

    write_zip(
        ZIP_VALID / "002_primary_data_name.excsv.zip",
        [("data.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        comment_full,
    )

    write_zip(
        ZIP_VALID / "003_with_aux_entries.excsv.zip",
        [
            ("003_with_aux_entries.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED),
            ("attachments/readme.txt", b"aux", zipfile.ZIP_STORED),
        ],
        comment_full,
    )

    write_zip(
        ZIP_VALID / "004_comment_full.excsv.zip",
        [("004_comment_full.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        comment_full,
    )

    write_zip(
        ZIP_VALID / "005_comment_truncated.excsv.zip",
        [("005_comment_truncated.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        comment_trunc,
    )

    write_zip(
        ZIP_VALID / "006_compression_store.excsv.zip",
        [("006_compression_store.excsv", canonical.encode("utf-8"), zipfile.ZIP_STORED)],
        comment_full,
    )

    write_zip(
        ZIP_VALID / "007_compression_bzip2.excsv.zip",
        [("007_compression_bzip2.excsv", canonical.encode("utf-8"), zipfile.ZIP_BZIP2)],
        comment_full,
    )

    bom_inner = ("\ufeff" + unicode_inner).encode("utf-8")
    write_zip(
        ZIP_VALID / "008_with_bom_inner.excsv.zip",
        [("008_with_bom_inner.excsv", bom_inner, zipfile.ZIP_DEFLATED)],
        to_comment_full(unicode_inner).encode("utf-8"),
    )

    write_zip(
        ZIP_VALID / "009_header0_inner.excsv.zip",
        [("009_header0_inner.excsv", header0_inner.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        to_comment_full(header0_inner).encode("utf-8"),
    )

    p = ZIP_VALID / "010_zip64_written.excsv.zip"
    with zipfile.ZipFile(p, "w", allowZip64=True) as zf:
        zi = zip_info("010_zip64_written.excsv", zipfile.ZIP_DEFLATED)
        with zf.open(zi, "w", force_zip64=True) as out:
            out.write(canonical.encode("utf-8"))
        zf.comment = comment_full

    # Comment defects are advisory: inner file still parses (C3-style).
    write_zip(
        ZIP_VALID / "011_comment_not_excsv_prefix.excsv.zip",
        [("011_comment_not_excsv_prefix.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        b"not-an-excsv-comment",
    )
    write_zip(
        ZIP_VALID / "012_comment_not_utf8.excsv.zip",
        [("012_comment_not_utf8.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        b"\xff\xfe\xfd",
    )
    disagree = to_comment_full(canonical).replace("version=0.3", "version=0.2", 1)
    write_zip(
        ZIP_VALID / "013_comment_header_disagree.excsv.zip",
        [("013_comment_header_disagree.excsv", canonical.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        disagree.encode("utf-8"),
    )


def make_invalid() -> None:
    base_lines = load_plain("plain/valid/020_canonical_full_small.excsv")
    # Smaller inner for invalid zip cases: one row, same meta shape.
    small_lines = [
        base_lines[0],
        "#@source: fixtures.zip",
        "#column name=id type=int",
        "id",
        "1",
    ]
    valid_inner = with_original_size(small_lines)

    missing_size = raw_text(
        [
            small_lines[0],
            "#@source: fixtures.zip",
            "#column name=id type=int",
            "id",
            "1",
        ]
    )
    write_zip(
        ZIP_INVALID / "001_missing_original_size.excsv.zip",
        [("001_missing_original_size.excsv", missing_size.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        to_comment_full(missing_size).encode("utf-8"),
    )

    mismatch = valid_inner.replace("original-size=", "original-size=9999", 1)
    write_zip(
        ZIP_INVALID / "002_original_size_mismatch.excsv.zip",
        [("002_original_size_mismatch.excsv", mismatch.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        to_comment_full(mismatch).encode("utf-8"),
    )

    write_zip(
        ZIP_INVALID / "003_primary_not_first.excsv.zip",
        [
            ("note.txt", b"aux first", zipfile.ZIP_STORED),
            ("003_primary_not_first.excsv", valid_inner.encode("utf-8"), zipfile.ZIP_DEFLATED),
        ],
        to_comment_full(valid_inner).encode("utf-8"),
    )

    write_zip(
        ZIP_INVALID / "004_primary_bad_name.excsv.zip",
        [("wrong_name.excsv", valid_inner.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        to_comment_full(valid_inner).encode("utf-8"),
    )

    p = ZIP_INVALID / "007_unsupported_compression_method.excsv.zip"
    write_zip(
        p,
        [("007_unsupported_compression_method.excsv", valid_inner.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        to_comment_full(valid_inner).encode("utf-8"),
    )
    patch_primary_method(p, 99)

    write_zip(
        ZIP_INVALID / "008_no_excsv_entry.excsv.zip",
        [("data.txt", b"not an excsv entry", zipfile.ZIP_STORED)],
        b"",
    )

    p = ZIP_INVALID / "009_encrypted.excsv.zip"
    write_zip(
        p,
        [("009_encrypted.excsv", valid_inner.encode("utf-8"), zipfile.ZIP_DEFLATED)],
        to_comment_full(valid_inner).encode("utf-8"),
    )
    patch_encrypted_flag(p)


def main() -> None:
    ensure_dirs()
    make_valid()
    make_invalid()
    print("Generated zip fixtures in fixtures/zip/{valid,invalid}")


if __name__ == "__main__":
    main()
