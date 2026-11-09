# City Inspect applicant connection — inspected 2026-11-09

## Scope and outcome

Authenticated, read-only inspection of Ogden Valley City's actual applicant account. No credentials, contact values, session tokens or account screenshots are stored in this repository. No application saved/submitted, document uploaded, payment made or inspection requested.

- Verified: login, Building Permits module, mandatory initial password setup (completed by the user), applicant dashboard, blank new-application form, permit-type selection, inspection schedule.
- Attempted but unresolved: later application pages, document uploads, reviewer comments, receipts, revision workflow and status transitions. The account has no permit records; advancing the blank form could create a production record.
- Unverified: session lifetime, unattended reauthentication, post-login challenges, automation permission and an applicant-facing API. Successful interactive access does not prove unattended operation.

## Observed routes

These routes were reached through visible navigation, not guessed:

- `/login/selectModule`: Building Permits, Business License, Code Enforcement, Excavation Permits, Planning & Zoning.
- `/builder` and `/builder/permits`: pending payment, active permits, archived permits; all empty in the inspected account.
- `/builder/permits/add`: first application page.
- `/builder/schedules`: inspection schedule and an inspection action; no inspection initiated.

All routes are under https://ogdenvalley.cityinspect.com . City registration is linked from https://ogdenvalley.gov/planning/ . Registration includes a CAPTCHA; the temporary-password sign-in requires user password personalization. Do not store the temporary password or capture new passwords.

## First-page field mapping

| Portal field | Cornerpin input / handling |
|---|---|
| Permit Type | Explicit project scope; observed options include Single Family Dwelling and Pool. Never infer a pool filing from a pool feasibility scenario alone. |
| Project Name | User-reviewed project label; the address is a suggested label, not evidence that this is the city's required convention. |
| Builder Name | Confirmed contractor; do not substitute owner or applicant automatically. |
| Builder Phone | Confirmed contractor phone; missing from current application model. |
| Builder Email | Confirmed contractor email; missing from current application model. |
| Contact Name | Applicant/authorized contact; portal prepopulates the account contact. |
| Contact Phone | Confirmed contact phone; missing from current application model. |
| Contact Email | Confirmed contact email; missing from current application model. |
| Inspection Emails? | Explicit notification preference, initially Yes on the inspected form. |

The permit type is visibly marked required. Other requirements may be enforced on submission; no blank-form validation was triggered. Actions are `save & close` and `continue`; neither was clicked. The page shown before those actions contains no property-address, plan-upload or signature fields, so mappings for those remain unverified.

## Tracking observations

Permit tables expose date, permit details, owner/builder, subdivision/lot, permit type, street address, description and last inspection. With zero records, there is no verified application-reference format, detail-page mapping or reviewer-comment structure. An empty table is not evidence of a functioning monitoring connector. The portal displays a notice that building fees are determined by the fee schedule at final issuance and may change with semiannual valuation-data updates.

## Next acceptance gates

1. Obtain vendor-supported API/test-environment guidance (user sent inquiry), or confirm supported applicant-authorized automation.
2. Inspect an authorized real draft or vendor-approved test application. Never create a fictitious production permit to bypass the lack of samples.
3. Record required fields, attachments, file limits, draft behavior and final certifications from the actual later pages.
4. Implement separate preparation, user authorization, submission attempt and receipt states. A successful click is not a filing receipt; retry only after reconciling whether a record exists.
5. Verify comments/documents/status on an authorized record; establish polling or webhook behavior and source timestamps. Test stale sessions, failures and duplicate events.
6. Validate a permitted full cycle: application, attachment, receipt, correction, revised attachment, resubmission and status update.

No live automated filing or monitoring capability is enabled by this inspection. Platform connectors can be reused across jurisdictions, but each jurisdiction still needs verified form configuration, permissions and local requirements.
