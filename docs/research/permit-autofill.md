# Permit autofill and Claude extraction

## Implemented capabilities

- Direct property mappings retain provenance; saved applicant and explicit subdivision phase flow into the form.
- Correctly reads garage area from `plan.footprint.garage_sf`.
- Explicit floor schedules, finished/unfinished basement, garage, bedroom/bathroom/story counts and explicitly labeled design-professional contacts are parsed without a model. Conflicting values remain unresolved.
- Uploaded plan facts retain page, quote, units and filename through report saves. A main-floor area is no longer mistaken for total residence area.
- The document reader supports all mapped application types. Users confirm that the selected document describes the proposed permit scope. Extracted results stay scoped to that type; existing whole-dwelling plan suggestions apply only to dwelling permits.
- Optional Claude receives the complete original PDF, including page images and text, after direct extraction. It cross-checks direct answers so differing figures on other sheets become conflicts. It returns candidates for missing supported fields, not approvals, signatures, licenses, land values or invented construction estimates.
- Printed values must occur in their quoted evidence. Text-matched evidence is distinguished from visual readings requiring human review. Drawing-only readings retain a page and location; they are not represented as independently verified. Actual setbacks require explicitly proposed/actual supporting text and cannot use a quoted minimum/required setback. Semantic interpretation still requires review.
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

Drawing-aware extraction: up to 150 PDF pages, 25 MB per source. Claude receives all original pages and up to 6,000 output tokens; the request times out after 240 seconds within the 300-second existing project function. No new serverless function is added. Unreadable handwriting and undimensioned geometry remain unresolved; no claim of certified measurements. The number of pages sent is disclosed. Full-permit accuracy across a representative collection of plans remains unmeasured. Any original approval, signature, contractor decision or engineering measurement must still be obtained from evidence/user input.

API reference: https://platform.claude.com/docs/en/build-with-claude/structured-outputs


## Drawing-aware validation (November 9, 2026)

The previous keyword-ranked, truncated text pipeline omitted layout and prioritized dense notes. The replacement sends the original PDF as an Anthropic document content block. It can read room labels and drawing annotations, not merely search flattened text. Printed numeric strings with valid thousands separators are normalized. Duplicate room identities, invalid pages, inconsistent count arithmetic and unsupported count fields are rejected. Counted bathroom totals use full=1 and half=0.5, with each room listed. Office/bonus rooms are not bedrooms; a separate toilet compartment within a bathroom is not another bathroom. All visual counts require review.

A private, user-supplied 25-page plan was run through the real API and its room counts independently inspected on the drawings. The final run produced eight candidate facts spanning seven fields with no rejected results. Private regression assertions confirmed bedroom/bathroom/story counts reach the application, room-level evidence renders, and inconsistent garage figures on two sheets leave the field blank. No proprietary plans, identifiers, personal contacts, or benchmark values are committed. The final run consumed 135,320 input and 2,768 output tokens: $0.29832 at the configured rates. This is a measured single-document read cost, not a whole-permit completion claim.

The prompt/parser cache version changed, so old text-only results will not suppress a fresh drawing read. Reopen Permit filing and choose Find remaining answers with Claude for the current document to replace a saved old result. It does not automatically charge users to refresh their saved projects.

For another real plan, run `scripts/benchmark-permit-extraction.js` with an explicit input PDF, private output path and `ANTHROPIC_API_KEY` in the environment. It refuses to overwrite an existing output and writes private results with mode 0600. Independently inspect the cited drawing locations; a model response alone is not accuracy evidence.

The deployment uses 12 API entrypoints. `build.py` fails before publication if that count exceeds 12. Extraction remains an action of `/api/projects`, with the document handler under `lib/`.

PDF API reference: https://platform.claude.com/docs/en/build-with-claude/pdf-support
