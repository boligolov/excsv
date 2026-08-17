# CSVW Compatibility

## Declaration

The header line **MAY** include one of:

| Value              | Meaning                                 |
| ------------------ | --------------------------------------- |
| `csvw=inline-json` | CSVW metadata is inline JSON            |
| `csvw=base64url`   | CSVW metadata is Base64URL-encoded JSON |

## Payload

```
#csvw: {"tableSchema": {"columns": [...]}}
```

`#csvw:` followed by the value to end of line. One optional leading space after `:` is skipped (readability only).

- The payload **MUST** be valid JSON (after decoding if `base64url`).
- Readers **MAY** ignore CSVW metadata entirely.

## Schema Precedence

| `schema` value    | Behavior                                    |
| ----------------- | ------------------------------------------- |
| `excsv` (default) | ExCSV `#column` annotations take precedence |
| `csvw`            | CSVW `tableSchema` takes precedence         |
