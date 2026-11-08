# Pilot valuation data-access solution

Decision prepared 2026-11-07. No account, purchase, licensing agreement, outreach or provider integration has been activated.

## Recommended access route, conditional on scope approval

Request a limited historical-data evaluation from UtahRealEstate.com Data Services through its official vendor portal. Its official API announcement describes distribution to licensed vendors/brokers; its current Web API login links Data Services, registration, contact, FAQ and documentation. This establishes a technical/licensing path, not entitlement to any specific feed or permitted valuation use. Vendor documentation returned 403 during this investigation; schema, price, historical depth and commercial permissions remain unverified.

Sources:
- https://resoapi.utahrealestate.com/login
- https://vendor.utahrealestate.com/contact
- https://blog.utahrealestate.com/index.php/2021/02/19/utahrealestate-com-helps-open-new-era-in-real-estate-technology/
- https://www.utahrealestate.com/about/contact/ (801-676-5400; request Data Services/Data Licensing)

This route changes the user's public-sources-only constraint. Do not buy, register, accept terms or obtain a broker's export on an assumption of permission. A broker partnership is useful only if the MLS authorizes the vendor and proposed use; membership credentials or an informal export are not a data license.

## Small, testable request

Request counts and a representative evaluation extract for closed vacant-land transactions in Eden, Liberty and Huntsville, preferably 2016–2026, with geometry-based Ogden Valley coverage rather than ZIP-only filtering. Separately request finished single-family transactions if residual development budgets will be evaluated. Do not mix improved homes into vacant-land labels.

Confirm these rights separately: automated retrieval; historical storage; internal valuation development; independent backtesting; derived valuations delivered to users; comparable display; redistribution; refresh/deletion obligations. Do not assume an IDX or VOW license permits all of these. Ask whether a sponsoring broker is required, whether an evaluation license is available, and the total recurring and setup price. No quoted cost is presently verified.

Required fields: stable listing/transaction IDs, parcel IDs and geometry/address, close date and actual close price, price provenance/disclosure flags, concessions and financing, multi-parcel/bulk/related-party/distress indicators where available, property subtype, gross lot area, utilities, access, zoning/entitlement representations, and dated listing/status/field history. Missing actual prices, cash-equivalence adjustments or property identities remain unresolved.

Require provider documentation of historical semantics: does a historical record contain the property characteristics at that time, or today's overwritten fields? Are original listing snapshots, change events, original-entry/close-report/modification timestamps and backfilled fields available? A sold listing pulled today is not automatically an immutable pre-sale snapshot.

## Qualification before integration or payment

1. Inspect geography/year/property-subtype counts, missing actual-price rates and coverage of the target acreage/service segments. Avoid a handpicked sample as evidence of representativeness.
2. Cross-check a sample of actual closed prices/IDs against available source records. Reject inferred prices and mortgage-derived estimates as outcome labels.
3. Trace several historical listings through field changes to establish which predictors existed before the target's contract/valuation cutoff. Otherwise exclude those fields or use a clearly labeled retrospective test, distinct from an operational historical replay.
4. Review the license against the intended processing and public display. Stop if permission does not cover the product.
5. Only after qualification, implement the documented server-side adapter; retain provenance, revision timestamps and access restrictions. No endpoint or schema is guessed in advance.

ATTOM is only a coverage-tested alternative, not a proven solution. Its documentation includes disclosure-type flags and its own materials describe estimated sale values in nondisclosure states. Require demonstrably actual Utah closing prices, source rights and historical features before considering it.
- https://api.developer.attomdata.com/docs
- https://www.attomdata.com/news/attom-insights/industry-voices/webinar-gaining-powerful-insight-utilizing-attoms-real-estate-valuation-data/

## Backtest after qualification

Separate training, uncertainty-calibration and held-out test periods. Freeze model/feature choices before examining holdout errors. Use earlier eligible comparables only, exclude the target parcel and related transactions, and group related subdivisions in a robustness check. Compare with a simple unit-price baseline. Report sample counts, abstention rate, dollar/percentage errors, bias, prediction-interval coverage and width, and performance by acreage/readiness segment. Choose sample requirements and release thresholds before scoring; twenty observations is an existing software floor, not proof of sufficient validation. Do not infer validated 2026 accuracy from the four recovered 2019 observations.

## If public-only remains non-negotiable

Continue public exhibit discovery and ask the county whether any releasable transaction-level sales-study data with dated characteristics exists. No assumption that MLS-derived or confidential records are releasable. This path has produced four historical source-priced observations, but no representative current holdout set. Under this constraint there is presently no demonstrated way to deliver the requested defensible pilot valuation. Keep it explicitly unavailable; residual scenarios remain a separate product capability, not a substitute.
