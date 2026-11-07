# Pilot valuation backtest attempt — 2026-11-07

**Result: blocked; zero scorable holdouts. No market-accuracy percentage established.**

This was a focused public-source availability audit, not an exhaustive census of every pilot transaction. Three listing/property candidates were screened. None supplied sufficient verified closing-price and historical-feature evidence. The official assessor, tax-sale and statewide auction sources were also assessed for suitability; their limitations are recorded in the input manifest. There is no basis to infer that no usable public transaction exists anywhere.

The ERA page explicitly confirms a sale but withholds its price. The Homes page supplies an asking price rather than a closing price. The Movoto search record withholds price/date and direct retrieval failed. Assessor values are not sale outcomes; distressed tax deeds and remote statewide auction parcels were not substituted for local residential-lot outcomes. The ERA page also publishes a commercial reuse restriction; public visibility does not establish permission to ingest a commercial training set. Only audit URLs and exclusion notes are retained here, not scraped listing descriptions.

## Reproduce

```
node scripts/backtest-valuations.js docs/research/backtest/public-source-audit.json docs/research/backtest/result.json
node scripts/test-valuation-backtest.js
```

The runner follows the existing candidate model's median adjusted price-per-usable-acre calculation, but only supports zero adjustments in this initial research evaluation. It never supplies fabricated validation metadata to unlock published valuations. Each test target uses only earlier publicly available sales, excludes other transactions of the same parcel, and requires pre-sale feature evidence. It produces absolute dollar error, median absolute percentage error, bias, proportions within 10% and 20%, a simple median-sale-price baseline, and a record-by-record exclusion/abstention log. Interval coverage remains null without separate calibration evidence. Actual absence of observations produces null metrics, never zero error.

## What remains required

A permitted set of verified pilot-area closing prices and transaction dates, stable parcel identities, ordinary transaction qualifications, historical feature/usable-area sources and publication dates. Use chronological training/calibration/test partitions; keep related subdivisions grouped in a second robustness check. Calibrate site/time adjustments on training only, compare with the unadjusted baseline, and evaluate errors by acreage and service/entitlement groups. Neither these steps nor interval calibration can be empirically completed from the present zero-eligible-observation input.

Synthetic fixtures test the runner's arithmetic and leakage rejection only. The original objective—measuring defensible pilot market accuracy—remains attempted but blocked by missing eligible observations. No production valuation is promoted or changed by this run.

## Follow-up: historical sales recovered

A broader county acquisition-packet search recovered four distinct 2019 Ogden Valley transactions with explicit sold prices, dates, gross acreage, parcel references and listing-era service/terrain characteristics. See `historical-sales-seed.json`; prices and dates were visually checked against PDF pages 9, 10, 12, 14 and 15. The original source is a county-published Administrative Compensation Estimate, explicitly not a USPAP appraisal. Its underlying comparables are MLS sold reports. The proposed right-of-way compensation itself is not a market-sale observation.

This corrects the earlier narrow-search result: public historical prices can be found. It does not establish a complete, representative or current dataset. One of the four sales includes a home and outbuildings and must be excluded from the vacant-land baseline. The other three require transaction/parcel-scope review. Gross acreage must not be silently assigned to usable acreage. The reports were printed after the sales, so immutable pre-sale feature snapshots and public availability before each target sale are not established. No existing strict backtest gate has been relaxed, and the old zero-score result remains the result of its original input manifest.

Archive coverage: retrieved 16 county-index packet candidates selected by appraisal/ROW/property keywords; inspected text where present and OCRed the cover of 14 scanned candidates. The other covers concerned western-county corridors, a lease, or an unrelated theatrical rental. A further 2024 surplus-property packet concerned an adjoining-owner disposal in Plain City and was excluded. This was a bounded keyword/cover audit, not a complete OCR search of every county document.
