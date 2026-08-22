# File metadata (`#@`)

`#@` lines carry facts about the *dataset as a whole* — not the columns, the table itself. Everything after the colon is plain text (one optional space after `:` is trimmed), so write it however reads well.

| Key | What it captures | Example |
| --- | --- | --- |
| `source` | Where the data came from — system, table, or file | `#@source: sales_db.orders` |
| `author` | Who made it | `#@author: alex@example.com` |
| `comment` | A free-text description of the dataset | `#@comment: demo dataset` |
| `grain` | What a single row represents | `#@grain: one row per order` |
| `created` | When it was created (ISO 8601) | `#@created: 2026-03-24T12:00:00Z` |
| `exported` | When it was exported | `#@exported: 2026-03-24T14:30:00Z` |
| `license` | The data's license | `#@license: CC-BY-4.0` |
| `tool` | What generated the file | `#@tool: excsv-cli/0.2.0` |
| `tags` | Comma-separated tags | `#@tags: sales,Q1,2026` |

These keys are conventions — use any key you like; anything you invent is kept as-is. There's one value per key per file.

A ZIP comment may end with `#@comment-truncated: 1` when the archive comment hit its 65535-byte limit and some metadata was left out. That's written by the zipper into the comment, not into the file itself — see [ZIP](zip.md).

## `grain` — the most useful line you'll write

`#@grain` says, in plain words, what one row *is*: `one row per order`, `one row per customer per day`, `pre-aggregated monthly totals`. It sounds trivial, but it's the single fact that stops half of all analysis mistakes — you can't accidentally double-count or misjoin when the file tells you the unit up front.

```
#!excsv version=0.3 delim=comma header=1
#@author: alex@example.com
#@comment: demo dataset for onboarding docs
#@source: analytics_db.page_views
#@created: 2026-03-24T10:00:00Z
#@grain: one row per page per day
#@tags: demo,analytics
#column name=page type=string
#column name=views type=int
page,views
/home,14200
/pricing,8700
```
