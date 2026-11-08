# Pilot valuation research and backtest — 2026-11-07

## Latest result: expanded search and real-sale diagnostic

The expanded audit contains **17 candidate records**, including six Zillow leads, four additional cross-source leads, the original three candidates and four county-hosted sold reports. Exact URLs, sale events, price classifications and exclusions are in `expanded-public-source-audit.json`; results are in `expanded-result.json`. This is a bounded evidence audit, not a census of the market.

**The strict candidate-model backtest still has zero eligible holdouts.** Four county records have source-verified sold prices; one includes buildings. For the other three, usable acreage, transaction conditions and historical public availability remain unresolved. The ten additional property leads did not supply attributable closing prices. A search snippet mentioning a numeric last-sold price did not establish that amount for its target property; direct Redfin histories withheld the prices. Zillow also labels at least one now-improved property VacantLand, which prevents blindly using today's attributes for an earlier land sale.

A separate, explicitly retrospective **gross-acre diagnostic** uses the three county land records. It holds out the latest sale and calculates a median unit-price estimate from the two earlier sales:

| Held-out sale | Reported sale | Gross-acre diagnostic | Difference |
|---|---:|---:|---:|
| MLS 1586757, 2019-12-05 | $835,000 | $1,321,063 | +$486,063 / +58.2% |

This is **one diagnostic observation**, not Cornerpin's measured market accuracy. It uses gross acreage, not the production model's usable acreage, and only two preceding sales. The reports became public after these transactions; the result cannot be described as a public-information replay. Agricultural/development tracts, unresolved parcel scope and unadjusted services/entitlements limit comparability. The result is evidence against relying on this simple calculation, not a basis for selecting a new model or publishing a valuation. An unscaled median-price baseline predicts $638,750, but its smaller error on this one target does not establish superiority.

The existing strict evaluation gates and production valuation remain closed. No Zillow scraping service, licensed feed or live valuation has been deployed by this research.

### Reproduce the latest outputs

```sh
node scripts/backtest-valuations.js docs/research/backtest/expanded-public-source-audit.json docs/research/backtest/expanded-result.json
node scripts/diagnose-historical-land-sales.js docs/research/backtest/historical-sales-seed.json docs/research/backtest/historical-diagnostic-result.json
node scripts/test-valuation-backtest.js
node scripts/test-historical-land-diagnostic.js
```

### Capability checklist

- Public-source candidate discovery and source-linked exclusions: implemented; bounded coverage, ongoing source acquisition remains necessary.
- Verified historical closing-price dataset: attempted, incomplete. Four source-verified reports found, only three are land-only candidates; not independently settlement-verified or representative.
- Pre-sale property information: attempted, unresolved. Listing-era attributes exist for the county records, but usable-area, scope and availability reconciliation are missing.
- Chronological evaluation tooling and leakage checks: implemented and tested. A retrospective gross-acre sanity check has also been executed, separately labeled.
- Defensible pilot valuation accuracy, adjustment calibration and interval coverage: **blocked by insufficient qualified historical observations**, not completed by the diagnostic.

Additional sources checked include a PCMLS Area 57 land-statistics report (aggregate figures, no identifiable closings), public auction results (high bids, not confirmed ordinary residential closings), broker sold pages and RealtyHop reference prices. None was silently substituted for a transaction-level outcome. Removing the commercial-reuse gate alone would not make this dataset backtest-ready.

## Earlier audit and retained methodology

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
