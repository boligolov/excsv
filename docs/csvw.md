# CSVW

If you already use [W3C CSVW](https://www.w3.org/TR/tabular-data-primer/) metadata, you can carry it inline instead of (or alongside) `#column` lines. Declare how it's embedded on the header:

| `csvw=` | Meaning |
| --- | --- |
| `inline-json` | The CSVW metadata is plain JSON |
| `base64url` | The CSVW metadata is Base64URL-encoded JSON |

Then put the payload on a `#csvw:` line:

```
#csvw: {"tableSchema": {"columns": [...]}}
```

If both ExCSV `#column` annotations and CSVW are present, `schema=` on the header decides who wins — `excsv` (the default) or `csvw`. Tools that don't care about CSVW simply skip it.
