# Notes and links (`#note`, `link=`, `#link`)

Three related constructs attach human context to the data without changing it:

- **`#note`** — a remark pinned to a cell, a row, a column, or the whole table.
- **`link=`** — a `#column` attribute: a URL template that makes every value in the column a link.
- **`#link`** — a URL pinned to one cell, for links that don't follow the column's template.

All three are **optional and advisory**, like `checksum=` or `#chart`: a consumer that ignores them still has a fully valid file. A note or link is never part of a value — it doesn't affect aggregates, formulas, or the checksum, and it is never read as data.

## Syntax

`#note` and `#link` use the same bare `key=value` tokenizer as `#column` ([Header § quoting](header.md)): values containing spaces **MUST** be quoted, and a literal `"` inside a quoted value is written `""`. Both are single-line, like every meta line; there is no escape for a newline.

```
#note row=2 col=amount author=alex@example.com created=2026-03-24T12:00:00Z text="Refund pending, see ticket 1234"
#link key=1042 col=invoice href="https://billing.example.com/inv/A-77"
```

A line that does not tokenize (e.g. an unterminated quote, a token without `=`) **MUST fail** (`note_malformed` / `link_malformed`).

Unknown attributes on `#note` / `#link` **MUST** be ignored, the same rule as [`#column`](columns.md#unknown-attributes); custom attributes **SHOULD** use the `x-` prefix.

## Addressing

`#note` and `#link` share the same address fields:

| Field | Value | Meaning |
| --- | --- | --- |
| `col` | column name, or zero-based index when `header=0` | Column the line is attached to. Same rule as `#column name=` / `index=`: with `header=1` it is a name, with `header=0` it is an index (or a name, if that `#column` declares one). |
| `row` | non-negative integer | Data row, zero-based, **not counting** the header row. |
| `key` | text | The row's value in the [id column](#the-id-column) — an alternative to `row`. |

A line **MUST NOT** set both `row` and `key` (`note_row_and_key` / `link_row_and_key`, FAIL).

### The id column

`key=` resolves against the table's **id column**:

1. the single column with `role=id`; or, if no column has `role=id`,
2. the single column with `unique=1`.

If there is no candidate, or more than one at the deciding step, the table has no id column and every `key=` line in it is unresolved (WARN, see [Resolution](#resolution)).

`key=` matches a row whose id-column field, as raw text after CSV unquoting, is exactly equal to the `key=` value. No type coercion is applied: `key=007` does not match `7`. A null field never matches. If several rows match (the uniqueness hint was wrong), the line attaches to the first matching row.

### Positional vs. key anchors

`row=` is a position: it stays correct only while the row order is unchanged. `key=` survives sorting, filtering and slicing, including by tools that know nothing about ExCSV. When the table has an id column, writers **SHOULD** emit `key=` rather than `row=`.

## `#note`

| Field | Requirement | Meaning |
| --- | --- | --- |
| `text` | **MUST** | The note (quoted). Plain text. Missing → `note_missing_text`, FAIL. |
| `col`, `row`, `key` | MAY | [Address](#addressing). |
| `author` | MAY | Who wrote it — free text, typically an email address. |
| `created` | MAY | When it was written — ISO 8601 datetime. |

The address fields present decide what the note is attached to:

| Fields | Attached to |
| --- | --- |
| `row`/`key` + `col` | one cell |
| `col` only | a whole column |
| `row`/`key` only | a whole row |
| none | the table |

```
#note row=2 col=amount text="Refund pending, see ticket 1234"
#note col=email text="Some addresses come from the old CRM and were never validated"
#note row=0 text="Test order, exclude from the report"
#note text="Q1 numbers are preliminary until the audit closes"
```

- Any number of notes **MAY** share one target. They are independent remarks; consumers **MUST** preserve their file order. There are no replies, threads, or resolved state.
- `text` has no markup. A mention such as `@bob` is ordinary text.

## `link=` on `#column`

| Field | Requirement | Meaning |
| --- | --- | --- |
| `link` | MAY | URL template; makes every non-null value in the column a link. |

```
#column name=order_id type=int role=id link="https://crm.example.com/orders/{$}"
#column name=customer type=string link="https://crm.example.com/c/{customer_id}"
#column name=homepage type=string link="{$}"
```

The cell's own value is still what is displayed; `link=` only says where it points. It does not make the column computed and it does not change its type.

### Template grammar

| Token | Substituted with |
| --- | --- |
| `{$}` | The current cell's value. |
| `{name}` | The value of column `name` in the same row. |
| `{N}` | The value of the column at zero-based index `N` in the same row — `header=0` only (same rule as `col=`). |
| `{{` | A literal `{`. |

Any other character, including a lone `}`, is literal.

- Placeholders take the **raw** value as written in the file, after CSV unquoting. `format=`, `unit=` and `type=` do not apply.
- Each substituted value **MUST** be percent-encoded as UTF-8 bytes with uppercase hex digits (`café` → `caf%C3%A9`, a space → `%20`), leaving only the RFC 3986 unreserved characters (`A–Z a–z 0–9 - . _ ~`) unencoded.
- **Exception:** a template that consists of exactly one placeholder and nothing else (`link="{$}"`, `link="{invoice_url}"`) substitutes the value **without** encoding: the value itself is the URL.
- If any placeholder's value is null, that cell has no link.
- A placeholder **MUST** reference a stored or materialized column of the same table. A placeholder naming no such column — or a virtual [computed column](columns.md#computed-columns-formula), which has no raw value — is `link_unknown_column` (WARN): the column is shown without links and reading continues.
- An unterminated `{` is `link_template_malformed` (WARN): the column is shown without links.

## `#link`

| Field | Requirement | Meaning |
| --- | --- | --- |
| `href` | **MUST** | The URL (quoted). Missing → `link_missing_href`, FAIL. |
| `col` | **MUST** | Column of the cell. |
| `row` / `key` | **MUST** (exactly one) | Row of the cell. |

A `#link` without `col`, or without either `row` or `key`, **MUST fail** (`link_missing_address`). `#link` attaches to a single cell only: a whole column already has `link=`, and a row or a table has nothing to click.

- A `#link` overrides its column's `link=` template for that one cell.
- Two `#link` lines resolving to the same cell: the last one wins (`link_duplicate`, WARN).
- `href` is used as is. It is not a template; `{` has no special meaning.

## Resolution

A line whose address does not resolve is never fatal:

- the `col` names no column, or its index is past the physical width;
- `row` is past the last data row;
- `key` matches no row, or the table has no [id column](#the-id-column).

Such a line is `note_unresolved` / `link_unresolved` (WARN). It **MUST** be preserved on read/write round-trip unchanged, so that a later fix to the data or schema can resolve it again.

## Safety

A link template or `href` from an untrusted file is untrusted input.

- Consumers **MUST NOT** fetch or follow links on their own.
- The scheme **MUST** be checked on the **final** URL — after template substitution. Only `http`, `https` and `mailto` (case-insensitive) **MAY** be rendered as links. Any other scheme, or a value with no scheme, **MUST** be shown as plain text (`link_unsafe_scheme`, WARN). Checking the template instead of the result would let a value such as `javascript:…` through `link="{$}"`.
- When exporting to `.xlsx`, writers **MUST** emit hyperlink objects and **MUST NOT** emit `=HYPERLINK(...)` formulas, which would turn a crafted value into formula injection.
- Renderers that emit HTML **MUST** escape both the displayed value and the URL.

## Writer obligations

Notes and links describe the data; tools that rewrite the data **MUST** keep them pointing at the same thing:

- **Reordering or removing rows** (sort, filter, slice): update every `row=`; drop lines whose row was removed. `key=` lines need no change, except that lines whose row was removed are dropped.
- **Renaming a column:** update `col=` and every `{name}` placeholder that refers to it.
- **Removing a column:** drop notes and `#link` lines attached to it; a `link=` template that referenced it becomes `link_unknown_column`.
- **Materializing or dematerializing** a [computed column](columns.md#computed-columns-formula) adds or removes a field, not a row: notes are unaffected. With `header=0`, index-based `col=` and `{N}` **MUST** be renumbered if physical positions shift.

### Size

`#note` and `#link` lines sit above the data section. They are meant for the handful of remarks and exceptions a person actually leaves — a per-row status or verdict is a column, not a note. Writers **SHOULD** keep the combined `#note` + `#link` block small (on the order of a few KiB), and **SHOULD** move a larger annotation set to a [sidecar](file-structure.md). An importer that faithfully reproduces many one-off links from a source file (see [Excel interop](#excel-interop)) **MAY** exceed this; it **MUST NOT** add columns to the data to hold them.

## Interaction with other features

- **Checksum.** [`checksum=`](checksum.md) covers only the data section. Adding, editing or removing notes and links never changes it.
- **Recommended order.** After `#chart`, before `#$` SQL — see [Meta lines](meta-lines.md#general-rules).
- **ZIP comment.** `#note` and `#link` have the lowest [priority](zip.md#priority-order): they are the first lines left out when the 65535-byte budget runs out.
- **Pack.** `#note` and `#link` live on a table's own `_header.excsv` and resolve only against that table. On `_manifest.excsv` they **MUST** be ignored (`note_on_manifest` / `link_on_manifest`, WARN). A note spanning tables is not defined.
- **Sidecar.** Notes and links in a sidecar resolve against the referenced data file. This is the recommended way to annotate data you may not modify.

## JSON mirror

| Text form | JSON form |
| --- | --- |
| `#column … link="…"` | `"link": "…"` on the column object |
| `#note` lines | root `notes` array (per-table in a pack), file order preserved |
| `#link` lines | root `links` array (per-table in a pack), file order preserved |

Each `#note` / `#link` becomes a flat object with its attributes as keys. `row` is a JSON integer; `col` is a string (a name) or an integer (an index, `header=0`); `key` is always a string (the raw id text). Unknown attributes are dropped, as for every other unknown key.

```json
"notes": [
  { "row": 2, "col": "amount", "author": "alex@example.com", "created": "2026-03-24T12:00:00Z", "text": "Refund pending, see ticket 1234" },
  { "col": "email", "text": "Some addresses come from the old CRM and were never validated" },
  { "text": "Q1 numbers are preliminary until the audit closes" }
],
"links": [
  { "key": "1042", "col": "invoice", "href": "https://billing.example.com/inv/A-77" }
]
```

## Excel interop

Informative, for tools converting to and from `.xlsx`.

**Notes from `.xlsx`.** Cell `B3` maps to `col=` (the name of column B) and `row=` (sheet row − 1 − header rows); when the table has an id column, an importer **SHOULD** write `key=` with that row's id value instead. A classic note becomes one `#note` with `author=` and `text=`. A threaded comment is flattened: each message becomes its own `#note` on the same cell, in thread order, author from `xl/persons/person.xml`; reply structure and the resolved flag are dropped. Rich text is dropped and line breaks become spaces.

**Notes to `.xlsx`.** Cell notes become classic notes; several notes on one cell are joined into one, one line each, prefixed with the author when set. Column-, row- and table-level notes have no Excel equivalent: a tool **MAY** pin them to the header cell or the row's first cell, or list them on a separate sheet.

**Links from `.xlsx`.** Per column, an importer picks the most compact exact form:

1. all hyperlinks fit one template built from the row's values → `link=` on the column;
2. every linked cell's value is its own URL → `link="{$}"`;
3. otherwise → one `#link` per linked cell; a column where most cells fit a template gets the template plus `#link` lines for the exceptions.

Internal links (`Sheet2!A1`, defined names) are not carried over; the importer **SHOULD** warn.

**Links to `.xlsx`.** Every resolved link that passes the [scheme check](#safety) becomes a hyperlink object on its cell.

## Error conditions

| Condition | Code | Severity |
| --- | --- | --- |
| `#note` line does not tokenize | `note_malformed` | FAIL |
| `#note` lacks `text=` | `note_missing_text` | FAIL |
| `#note` sets both `row=` and `key=` | `note_row_and_key` | FAIL |
| `#note` address does not resolve | `note_unresolved` | WARN |
| `#note` on a pack manifest | `note_on_manifest` | WARN |
| `#link` line does not tokenize | `link_malformed` | FAIL |
| `#link` lacks `href=` | `link_missing_href` | FAIL |
| `#link` lacks `col=`, or lacks both `row=` and `key=` | `link_missing_address` | FAIL |
| `#link` sets both `row=` and `key=` | `link_row_and_key` | FAIL |
| `#link` address does not resolve | `link_unresolved` | WARN |
| Two `#link` lines resolve to the same cell | `link_duplicate` | WARN |
| `#link` on a pack manifest | `link_on_manifest` | WARN |
| `link=` placeholder names no stored/materialized column | `link_unknown_column` | WARN |
| `link=` template has an unterminated `{` | `link_template_malformed` | WARN |
| Final URL's scheme is not `http`/`https`/`mailto` | `link_unsafe_scheme` | WARN |

Full definitions in [Error handling](error-handling.md#notes-and-links).
