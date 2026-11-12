# Public-record discovery worker

The background worker searches named public routes, retains raw source hashes and provenance, follows public attachments, reads native PDF/Word text, and OCRs scanned pages. The application receives a small exact-county/exact-parcel index. Raw acquisition caches are excluded from deployment.

## Run and resume

```sh
CORNERPIN_DISCOVERY_INDEX=data/title/discovery-index.json node scripts/discover-public-records.js config/discovery/weber-cobabe.json docs/research/cobabe-discovery
```

To retry transient failures after source cooldowns:

```sh
CORNERPIN_DISCOVERY_INDEX=data/title/discovery-index.json node scripts/discover-public-records.js config/discovery/weber-cobabe.json docs/research/cobabe-discovery --retry
```

The worker drains the discovered queue unless an optional positive job limit is supplied. Exit 2 means source checks remain incomplete, not that a source is private. Exit 1 is an execution failure. Retry-After is respected; absent that header, a 429 imposes a 15-minute cooldown. Failed attempts remain in the manifest. No credentials, paid services, AI API calls, email, or order submissions are used.

## Coverage and discovery

- Public Notice agenda searches split saturated date ranges instead of silently accepting the first 25 notices. A saturated single day or HTTP failure remains incomplete.
- Released-record searches traverse request and attachment lists, paginate against advertised totals, reject repeated pages, and retain exact-number checks for parcel and recording references.
- Public source libraries, sitemaps, WordPress search/media, embedded document URLs and archive indexes are followed within explicitly reviewed hosts. Unreviewed external hosts remain leads.
- Content hashes deduplicate originals. Native text, scanned pages and blank/illustrated pages are distinct. OCR text remains machine evidence needing review.
- Exact document reference identity does not establish parcel applicability. A proposed agreement is not the executed recorded agreement. A master association is not automatically the neighborhood reviewer.
- The index retains unresolved source checks and unread pages. It never changes a permit requirement to satisfied or exempt. Source coverage is a finite, documented search scope, not proof that every public record on the internet has been examined.

## Reuse and current boundary

The ingestion engine is profile-driven. A new area needs reviewed public-source hosts and seeds, exact county/parcel identity, relevant subdivision/recording aliases, and date scope. Do not reuse the Cobabe association seeds for unrelated parcels. Updating a profile requires retaining the old profile and search history or using a new run directory.

The deployed `.github/workflows/public-discovery.yml` runs daily at 10:23 UTC and can be dispatched manually with a 1–20 minute budget. `scripts/run-discovery-production.js` restores and advances the configured profiles, then publishes metadata commits through the existing Vercel integration. Each run saves a metadata-only checkpoint artifact for 30 days; original bytes and extracted text are not uploaded. OCR resumes against re-downloaded sources only when their hashes match. The local CLI remains available; its publication is automatic when `CORNERPIN_DISCOVERY_INDEX` is supplied. The existing public-research API attaches the last published discovery index to the exact parcel. An unrelated parcel gets no inferred rule. Indexes older than seven days are labeled refresh due; refreshing the UI does not silently certify stale research.

The master source catalogue still requires reviewed county/entry identity before it can supply a document as an exact recorded original. Broad discovery candidates are not promoted automatically. Hosted orchestration for the reviewed city and Cobabe source profiles is deployed and restart-tested. Automatic profile creation for arbitrary parcels and exhaustive legal-coverage interpretation remain unfinished capabilities. See `production-discovery-checklist.md` for current production evidence and open source gaps.

## Validation

Run `node scripts/test-record-discovery.js`, `node scripts/test-public-record-access.js`, `node scripts/test-original-acquisition.js`, `node scripts/test-public-research.js`, `node scripts/test-title-research.js`, `node scripts/test-title-links.js`, and `npm run build`.

Realistic cases covered: wrong near-match parcel rejected; scanned pages prevent completed-reading claims; missing sources prevent contact fallback; public viewer follows its actual download; rerunning a completed queue does not refetch; empty GIS results do not clear private requirements; current committee and pre-submission timing remain unverified until source evidence establishes them.
