# Permit autofill and Claude extraction

## Implemented capabilities

- Direct property mappings retain provenance; saved applicant and explicit subdivision phase flow into the form.
- Correctly reads garage area from `plan.footprint.garage_sf`.
- Explicit floor schedules, finished/unfinished basement, garage, bedroom/bathroom/story counts and explicitly labeled design-professional contacts are parsed without a model. Conflicting values remain unresolved.
- Uploaded plan facts retain page, quote, units and filename through report saves. A main-floor area is no longer mistaken for total residence area.
- The document reader supports all mapped application types. Users confirm that the selected document describes the proposed permit scope. Extracted results stay scoped to that type; existing whole-dwelling plan suggestions apply only to dwelling permits.
- Optional Claude reads bounded relevant PDF text after direct extraction. It returns candidates for missing supported fields, not approvals, signatures, licenses, land values or invented construction estimates.
- Numeric values and text quotes must occur on the cited page. Actual setbacks require explicitly proposed/actual supporting text and cannot use a quoted minimum/required setback. Semantic interpretation still requires review.
- Superseded document versions stop supplying facts. Conflicting sources prevent automatic filling. User-edited answers retain precedence.
- Source documents are fetched server-side from authenticated, owner-scoped Supabase storage and verified by SHA-256. No caller-supplied external URLs or arbitrary model prompts.
- Private result cache keys include document hash, parser/prompt version and model. Cached reads make no new Claude call.
- Immutable private storage slots cap paid attempts per account/day, default 20, configurable with `CORNERPIN_CLAUDE_DAILY_LIMIT`. No model keys or service-role credentials go to the browser.
- Token usage is retained; Sonnet 5.5 usage estimates use $2/M input and $10/M output (verified November 9, 2026). Hosting/storage costs are separate. Cached reads show zero additional model cost.

## Deployment

Set `ANTHROPIC_API_KEY` as a production-only Vercel secret. Default model is `claude-sonnet-5-5`, override with `CORNERPIN_CLAUDE_MODEL` after validating outputs and pricing. The authorized existing credential was configured through Vercel, not committed. The same Anthropic billing account pays for this traffic.

No database migration: private cache and budget objects use the existing owner-prefix storage policies. Existing files remain immutable.

## Validation and limits

Tests cover actual PDF text extraction, authentication and cross-owner rejection, citations, conflicts, units, scope isolation, document supersession, cache reuse, daily limits and malformed/incomplete responses. A real Claude call on synthetic source text returned material and actual front setback, leaving an unstated rear setback absent. The small call used 807 input / 116 output tokens ($0.002774 at the above rates); it is not a complete-permit cost benchmark.

A real 25-page plan benchmark selected seven text pages, used 44,521 input / 664 output tokens ($0.095682), and added zero validated Claude facts beyond the direct parser. One proposed material answer was rejected because its value was absent from its quote. This establishes a measured read cost, not successful full-plan extraction; drawing-heavy plans remain a quality gap.

Text-only extraction: up to 150 PDF pages, 25 MB per source. Claude gets at most 12 relevant text pages / 60,000 characters and 3,000 output tokens. Scanned/handwritten documents and diagram-only dimensions are explicitly unresolved; no visual accuracy claim. Page selection is disclosed. Full-permit cost/accuracy on a representative collection of real plans remains unmeasured. Any original approval, signature, contractor decision or engineering measurement must still be obtained from evidence/user input.

API reference: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
