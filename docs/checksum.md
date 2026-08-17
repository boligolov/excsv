# Checksum

A `checksum=` on the header is an integrity fingerprint of the data — a way to tell whether the rows are still exactly what they were when the file was written.

```
checksum=sha256:e3b0c44298fc1c149afbf4c8996fb924...
```

It's written as `<algorithm>:<hex-digest>` and covers the whole data section, so it survives being zipped, re-zipped, or moved around — the fingerprint is of the *content*, not the packaging.

It's advisory: a mismatch is a heads-up ("this data changed since it was fingerprinted"), not a lock. It never stops you from reading the file. If you want to catch silent edits or corruption, check it; if you don't care, ignore it.
