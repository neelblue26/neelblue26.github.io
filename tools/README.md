# Refreshing the SAT question bank

From the project directory, run:

```powershell
node tools/update-bank.cjs
```

This previews additions using the same practicesat metadata proxy used for the
original import. Questions are deduplicated by College Board UUID.

To download new content directly from College Board and update the site files:

```powershell
node tools/update-bank.cjs --apply
```

The updater validates question types, stems, options, answers, and explanations
before writing browser assets. It preserves existing questions and their UUIDs,
and changes the catalog and shard cache versions so returning users load the new
questions. Re-running it when there are no additions leaves site files unchanged.
New questions receive an import-batch marker, which powers the site's
"New questions only (latest update)" filter.
Downloads are cached locally in `api-build/cache` for interrupted imports.

Review and commit `apdata`, `bank.html`, and `index.html`, then push to publish.
Metadata entries without UUIDs are reported and cannot be fetched through this
content endpoint. This updater imports additions; it does not refresh existing
question content or infer active/inactive status.
