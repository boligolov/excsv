# Introduction

ExCSV is a self-describing, line-oriented tabular data format backward-compatible with plain CSV/TSV.

It extends CSV with:

- An inline metadata header
- Column schema annotations
- Optional aggregation metadata
- Optional SQL companions (DDL/DQL with dialect tagging)
- Optional embedded [CSVW](https://www.w3.org/TR/tabular-data-primer/) compatibility
- Optional ZIP container with summary in the archive comment

ExCSV is designed for CLI workflows, data interchange, human readability, and minimal parsing complexity.

## Design Goals (Non-Normative)

- Remain fully backward-compatible with CSV — any CSV reader can consume the data section.
- Support CLI processing with tools like `grep`, `awk`, `cut`, and `head`.
- Avoid mandatory JSON — metadata is line-oriented key-value, not a nested structure.
- Allow progressive enhancement — start with plain CSV, add schema, aggregations, and SQL as needed.
- Make zipped distribution first-class: integrity fields and summary metadata travel inside the archive itself.

## Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).
