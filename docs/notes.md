# Notes and links (`#note`, `link=`, `#link`)

> New in v0.6. The precise rules — grammar, resolution, error codes — are in [implementation/notes.md](implementation/notes.md).

A spreadsheet lets you pin a remark to a single cell: *"refund pending"*, *"why is this completed?"*, *"test order, exclude"*. CSV has nowhere to put that, so it ends up in a Slack thread or a separate review doc that drifts away from the data. `#note` puts it back in the file, the same way `#column` did for types.

```
#note row=2 col=amount author=alex@example.com created=2026-03-24T12:00:00Z text="Refund pending, see ticket 1234"
```

Like every other meta line, it describes the data and never changes it. A note isn't part of a value: it doesn't affect aggregates or formulas, and it's never read as data.

## What already exists, and the gap

| Level | Already in the spec |
| --- | --- |
| File | `#@comment:` (one value per file) |
| Column | `description=` on `#column` |
| Free text for humans | `##` (ignored by tools, dropped in JSON) |
| **Cell / row** | **nothing** |

`#note` fills the last row of that table. It also lets the levels above it hold several separate remarks, where `#@comment` and `description=` hold one value each.

It works especially well in a [sidecar](file-structure.md#sidecar--annotate-without-touching-the-data). You can review a vendor dump, a regulated export, or anything else you're not allowed to touch, and leave comments on individual cells while the data file stays byte-for-byte the same.

## Why `#note` and not `#comment`

"Comment" is already taken twice: `#@comment` (the dataset description) and `##` (a free-text comment line). A third meaning would be one too many. Excel went the same way: its classic cell comments are now called *Notes*.

## The line

A `#note` line uses the same `key=value` syntax as `#column`: values with spaces are quoted, and a literal `"` inside is written `""`. The note itself goes in `text=`, the same way a column's `description=` does.

```
#note row=2 col=amount text="Sum doesn't match the invoice"
```

| Field | Meaning |
| --- | --- |
| `text` | The note itself (quoted, single line). Required |
| `col` | Column it's attached to: by name, or by zero-based index when `header=0` (same rule as `#column name=`/`index=`) |
| `row` | Data row it's attached to: zero-based, **not counting** the header row |
| `key` | Alternative to `row`: the row's id value (see [Anchoring](#anchoring--keeping-a-note-on-the-right-cell)) |
| `author` | Who wrote it |
| `created` | When (ISO 8601) |

`text=` is a single line, like every other meta line: there's no `\n` escape. A note is a short remark; anything longer belongs in a linked document. Mentions like `@bob` have no special meaning — they're just part of the text.

Several notes can sit on the same cell, column, row, or table. They're independent remarks listed in file order, not a conversation: there are no replies and no resolved state.

A syntax like `#note row=2 col=x: free text`, with the text after a colon, was rejected. `created=2026-03-24T12:00:00Z` already contains colons, so the split point would be fragile. `text="…"` reuses the tokenizer every `#column` line already goes through.

## What a note attaches to

The address fields you set decide the level:

| Fields | Attached to |
| --- | --- |
| `row`/`key` + `col` | one cell |
| `col` only | a whole column |
| `row`/`key` only | a whole row |
| neither | the table |

```
#note row=2 col=amount text="Refund pending, see ticket 1234"
#note col=email text="Some addresses come from the old CRM and were never validated"
#note row=0 text="Test order, exclude from the report"
#note text="Q1 numbers are preliminary until the audit closes"
```

Excel only has the first level. The rest cost nothing extra here.

## Anchoring — keeping a note on the right cell

Excel pins a comment to an address (`B3`) and shifts it when *Excel itself* inserts rows. A CSV has no such guardian. If you sort it in pandas or cut the first 1,000 rows with `head`, a note on "row 2" now sits on someone else's order.

**`key=` anchors by id instead of position.** When the file has a column marked `role=id` (or `unique=1`), a note can point at the row by that column's value:

```
#column name=order_id type=int role=id unique=1
#note key=1042 col=amount text="Sum doesn't match the invoice"
```

`key=` survives sorting, filtering, and slicing — including by tools that know nothing about ExCSV. It's resolved against the single id column, so a file with zero or several candidates can't use it. A note sets `row=` or `key=`, never both. When an id column exists, writers should prefer `key=` over `row=`.

`row=` stays for files without an id column. It's only as reliable as the tools that touch the file: an ExCSV-aware tool updates it (see [below](#how-notes-interact-with-the-rest-of-the-file)), anything else can silently move the note to another row.

A note that doesn't resolve — the column is gone, `row=` is past the end, or no row has that `key=` — is a warning (`note_unresolved`), never an error.

## How notes interact with the rest of the file

- **Checksum.** [`checksum=`](checksum.md) covers only the data section, so adding, editing, or removing notes never changes it. The data is the same; people just talked about it.
- **Tools that rewrite the data.** A command that reorders or removes rows must update `row=` anchors, or drop notes whose row is gone. `key=` anchors need no change, only notes whose row was removed are dropped. [Materializing](columns.md#computed-columns) a column adds a field, not a row, so it leaves every note in place.
- **JSON.** Notes become a `notes` array. Unlike `##`, they survive a text → JSON → text round-trip:
  ```json
  "notes": [
    { "row": 2, "col": "amount", "author": "alex@example.com", "text": "Refund pending, see ticket 1234" },
    { "col": "email", "text": "Some addresses come from the old CRM and were never validated" },
    { "text": "Q1 numbers are preliminary until the audit closes" }
  ]
  ```
- **Pack.** Notes go in the `_header.excsv` of the table they describe, and they're scoped to that table, as `#chart` is. A note can't span tables.
- **ZIP comment.** Notes have the lowest priority in the archive comment. When the 65535-byte limit is hit, they're the first thing left out.

### Notes aren't a data channel

Notes sit above the data, so 10,000 of them push the first row 10,000 lines down. `#note` is for the handful of remarks a person would actually leave. If you need to flag every row — a data-quality status, a review verdict per record — that's a column, not a note. For a large review of data you can't touch, put the notes in a sidecar so the data file stays readable. As with `#index`, the notes block should stay small (on the order of a few KiB).

## Excel round-trip

**From `.xlsx`:**

- Cell `B3` becomes `col=` (the name of column B) and `row=` (the sheet row minus 1 minus the header row). With `header=1`, `B3` → `row=1`. When the table has an id column (the one `key=` resolves against), the importer writes `key=` with that row's id value instead of `row=`.
- A classic note (`xl/commentsN.xml`) becomes a `#note` with `author=` and `text=`.
- A threaded comment (`xl/threadedComments/`) is flattened: every message in the thread becomes its own `#note` on the same cell, in thread order, with the author from `xl/persons/person.xml`. Reply structure and the resolved flag are dropped.
- Rich-text formatting is dropped and line breaks become spaces. A note is single-line plain text.

**To `.xlsx`:**

- A cell's note becomes a classic note. Several notes on the same cell are joined into one classic note, one per line, each prefixed with its author when set.
- Column-, row-, and table-level notes have no Excel equivalent. A tool can pin them to the column's header cell or the row's first cell, or list them on a separate sheet.

## Links

Most links in a spreadsheet aren't one-off. It's rarely "this one cell points somewhere". Usually it's "every value in this column opens the matching page", which Excel users build with `=HYPERLINK("https://crm/orders/"&A2, A2)`. In ExCSV that's a **template on the column**:

```
#column name=order_id type=int role=id link="https://crm.example.com/orders/{$}"
#column name=customer type=string link="https://crm.example.com/c/{customer_id}"
#column name=homepage type=string link="{$}"
```

- `{$}` is the current cell. `{other_column}` is another column's value in the same row, so the link can point somewhere keyed by a different field. When `header=0`, columns have no names and are referenced by zero-based index: `{2}` (same rule as `col=` on `#note`).
- Placeholders take the **raw** value as written in the file. `format=` is for display only and doesn't apply.
- Placeholder values are URL-encoded when substituted. The exception is a template that consists of a single placeholder and nothing else: `link="{$}"` or `link="{invoice_url}"` means the value itself is the URL, so it's used as is.
- A literal `{` in the template is written `{{`.
- The cell's value is still what's displayed. `link=` only says where clicking it goes, and it doesn't turn the column into a computed one.
- A null in any placeholder means that cell has no link.
- A placeholder naming a column that doesn't exist is a warning (`link_unknown_column`): the column is shown without links and reading continues.

### One-off links: `#link`

When a cell's link doesn't follow the column's pattern, `#link` attaches it to that one cell. It uses `#note`'s addressing:

```
#link row=2 col=invoice href="https://billing.example.com/inv/A-77"
#link key=1042 col=invoice href="https://billing.example.com/inv/A-77"
```

| Field | Meaning |
| --- | --- |
| `href` | The URL (quoted). Required |
| `col` | Column of the cell. Required |
| `row` / `key` | Row of the cell, same rules as on `#note` (one of them, never both). Required |

- A `#link` targets a single cell only. A whole column already has `link=`, and a link on a row or a table has nothing to be clicked.
- A `#link` overrides the column's `link=` template for its cell. The displayed value is still the cell's value.
- Two `#link` lines on the same cell: the last one wins, with a warning (`link_duplicate`).
- An address that doesn't resolve is a warning (`link_unresolved`), never an error.
- Everything else works as for notes: the checksum doesn't cover it, a tool that reorders rows updates `row=`, it lives in its table's `_header.excsv` in a pack, and it has the lowest priority in the ZIP comment, alongside notes. In JSON, `#link` lines become a `links` array: `{ "row": 2, "col": "invoice", "href": "https://…" }`.

Like notes, `#link` sits above the data. A file where every row has its own unrelated link is legal, but each one is a line before the first row of data. If that's your file, consider putting the meta in a [sidecar](file-structure.md#sidecar--annotate-without-touching-the-data).

### Links and Excel

**From `.xlsx`**, an importer looks at each column's hyperlinks and picks the most compact form that reproduces them exactly:

1. All hyperlinks fit one template built from the row's values → `link="https://…/{$}"` on the column.
2. Each linked cell's value is its own URL → `link="{$}"`.
3. Otherwise → one `#link` per linked cell. A column where most cells match a template gets the template plus `#link` for the exceptions.

ExCSV describes the data and never changes it, so an importer doesn't add a URL column to hold the links: whatever doesn't fit a template is listed as `#link` lines, however many there are. Internal links (`Sheet2!A1`, defined names) aren't carried over; the importer warns and drops them.

**To `.xlsx`**, every resolved link — from a template or a `#link` — becomes a hyperlink object on its cell.

**Links inside the data**, like Excel's `Sheet2!A1` or a defined name, are relationships between tables. ExCSV already models those with [`#fk`](pack.md) in a pack, and a plain-file `references=` hint is on the roadmap. No separate link mechanism is needed.

### Links and safety

A link template in a file from an untrusted source is untrusted input:

- Tools don't follow links on their own. Only `http`, `https`, and `mailto` are rendered as links; anything else (`javascript:`, `file:`, …) is shown as plain text. The scheme is checked on the final URL, **after** substitution: otherwise a value like `javascript:…` would slip through `link="{$}"`.
- When exporting to `.xlsx`, a tool writes real hyperlink objects, **never `=HYPERLINK(...)` formulas**. Otherwise a crafted value becomes formula injection the moment someone opens the file in Excel.

---

**Building a tool?** The normative rules — tokenizer, id-column selection, template encoding, writer obligations, and the full list of `note_*` / `link_*` codes — are in [implementation/notes.md](implementation/notes.md).
