# Permit extraction audit

## Capability checklist

- [x] Source-backed form answers, rather than hypothetical all-profile coverage.
- [x] Retain public owner mailing information, match the named owner, and reuse it in the application.
- [x] Read complete plan PDFs plus enlarged first-page title-block details; use sequential bounded rendering.
- [x] Allow drawing-based counts of units, buildings and garages with unique located components and checked arithmetic.
- [x] Reuse explicitly extracted primary contact facts across matching application fields.
- [x] Retain field-specific extraction gaps and show them in the permit progress report and field guidance.
- [x] Name the user-facing assistant CornerpinAI; keep provider disclosure and server credential names accurate.
- [ ] Verify the new results in the live signed-in account after deployment.

## Evidence contract

Document suggestions remain suggestions until reviewed. Every fact retains the original file hash, page, quotation and (for visual readings) drawing location. Drawing counts enumerate distinct components; parking spaces do not become garage counts. Public mailing addresses are conditional on owner-name agreement and never default to the property's situs address. New versions invalidate old document evidence.

The progress report separates distinct fields supported by records or extraction from copied team profiles and administrative draft text. Neither a synthetically complete profile nor a connected form mapping is an extraction success.

## Real-plan validation

Use the private, user-provided 25-page plan set and an exported saved project. Keep the plan, extracted identities, address, and full audit outside this public repository. Compare actual before/after application rows, not standalone extraction counts. Inspect drawing-count components and conflicting quantities on rendered pages. Test owner mailing retrieval against the actual county page, then exercise the same logic with anonymous regression fixtures.

## Remaining document dependencies

Actual setbacks require both the proposed footprint and parcel boundaries with an established orientation. The current private test plan does not supply that relationship. Gross floor areas require a reliable gross schedule or reviewed calibrated boundaries; room areas and a total residence label are not substitutes. Unknown appointments, signatures and approval decisions cannot be supplied by an extraction model. These are documented gaps, not filled values.
