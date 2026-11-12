# Production discovery and Ogden Valley coverage

## User-facing capability checklist

- Address/parcel matches authoritative municipal and overlay GIS; source conflicts remain visible (existing, retained).
- Public originals have direct links; private membership and approval timing are not inferred from neighborhood names (existing, retained).
- Unattended public discovery with saved progress, bounded retries and OCR: implemented as a daily GitHub Actions worker, deployed; hosted checkpoint validation in progress.
- Vercel receives sanitized discovery evidence; acquisition files stay out of deployment bundles: implemented, deployed.
- Cobabe and city code/planning/neighborhood libraries have separate production profiles. These are configured source routes, not a claim of all possible sources.
- HR sewer/septic lot area, rental-room increment/density, side-yard totals, residential adjacency, green space/FAR; FV-3 wide-road frontage; corner/coverage/impervious measurements and shoreline federal-boundary setback: implemented with explicit scope fields and regression examples.
- Full exact-use/exception interpretation for every commercial/mixed proposal: attempted but unresolved; existing sourced review gates remain. No automatic legal compliance certification.
- Shoreline later amendment, forest PDF editing ambiguity, Cobabe conflicting instrument references and incomplete declaration exhibits: attempted but unresolved. Preserve the source conflict until an authoritative original resolves it.
- Production deploy and live API verified. Hosted checkpoint/resume validation in progress.

## Operational model

`.github/workflows/public-discovery.yml` runs daily, serializes writers, restores the newest nonexpired checkpoint artifact, processes a bounded batch and uploads the checkpoint even after failure. Metadata artifacts retain 30 days; daily successful runs renew retention. A prolonged outage beyond retention requires a new crawl and does not establish source completeness. Each profile receives a bounded share of worker time. Completed queues refresh after seven days. Raw documents and extracted page text are excluded from checkpoints and deployment bundles. OCR resumes by downloading the original and verifying its recorded SHA-256; changed originals remain unresolved. Sanitized index updates commit to main for the existing Vercel integration. GET `/api/public-research` exposes the latest published worker coverage and Actions run link; POST retains the existing research API.

The scheduler maintains reviewed source profiles. It does not automatically create a new legal HOA profile for every arbitrary address. Live address/GIS screening continues through the existing application.

Additional implemented coverage: CV-2 stories/centerline/abutment exceptions; MV-1 wide-right-of-way height and additional front setback; CVR-1 project area, residential adjacency and commercial floor shares; O-1/G base dimensions; RMH corner lot, height/story and coverage. ADU application feasibility letters, land-use-before-building application (with combined-process exception), recorded notice before issuance and distinct fire/address/water/wastewater/building reviews are explicit records. Exact commercial use eligibility and unencoded exceptions still require original-source review.
