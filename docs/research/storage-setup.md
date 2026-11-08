# Cornerpin accounts and private storage

## Capability checklist

- [x] Separate **Cornerpin Free** organization, independent of Palate administrators and billing.
- [x] Project `emvjiadexwjunippsbkb` provisioned; production site URL configured.
- [x] Owner-only project table and private immutable-file bucket deployed.
- [x] Account panel: sign-in, signup, email confirmation callback, password recovery/update, sign-out. Signup and recovery remain gated until email delivery is configured.
- [x] Guest and signed-in account device stores separated, including checklist attachments; switching accounts clears the report and plan from view.
- [x] Explicit **Save to account** includes document checksums; Projects lists private cloud copies for restoration on a different device.
- [x] Live SQL role tests passed for owner reads, cross-user reads/updates, forged owners, file paths, file immutability, stale revisions and anonymous denial. Synthetic rows/users rolled back.
- [x] Public HTTP checks: Auth enabled with email confirmation required; anonymous project read denied; bucket not publicly accessible.
- [ ] Real email-confirmed signup, password-reset delivery and real-user cross-device roundtrip: **blocked by an email sender and verified sending identity**, not Supabase capacity. No live login accounts have been created.
- [ ] Authenticated file-byte roundtrip over the live Storage API: **blocked by test-user authentication**. Local backup byte roundtrips and SQL storage policies tested separately; these are not a substitute.

## Configuration

`config/cloud.json` contains only the intended public project URL and **publishable** key. The server validates key type; it never uses a service-role key. Environment variables `CORNERPIN_SUPABASE_URL` and `CORNERPIN_SUPABASE_ANON_KEY` can override them. `CORNERPIN_AUTH_EMAIL_READY=true` enables signup/reset UI once email delivery has actually been tested. No admin key, database password or account token belongs in the repository.

Applied `db/project-storage.sql` on November 7, 2026. It explicitly grants only project select/insert/update to authenticated users and enforces ownership with RLS. `db/test-project-rls.sql` contains the rollback-only live checks.

Supabase Auth Site URL: `https://lot-dossier-assistant.vercel.app/`. There are no wildcard redirect allowances. Enable a local redirect only when deliberately testing a confirmation callback locally.

## Remaining email setup

The owner has no domain or email service yet. Supabase's default SMTP sender allows only organization-member recipients and two messages per hour; adding ordinary testers as organization administrators is not an acceptable workaround. Do not disable email verification. Configure a sender (for example Resend or another SMTP provider) and a verified sending identity, then test confirmation and password-reset delivery before enabling `emailReady`. An upgrade to Supabase Pro alone does not configure this.

## Persistence behavior

The official pinned Supabase SDK refreshes sessions. Sessions persist in **sessionStorage** for the browser tab and survive reloads; closing the tab requires signing in again. Tokens are never included in exports. Device data is partitioned by account ID, with the legacy guest database preserved separately. This is application-level separation; someone with direct access to a device's developer tools can still inspect its local databases.

Cloud saves are explicit, not background autosync. A device tracks the cloud revision it last saved/restored and rejects stale remote changes. Restoring never overwrites an existing local project. To move a guest project into an account, export its complete backup as a guest and restore it after signing in. The account does not implicitly claim guest work.

Owner-only, not team sharing. City connection, automatic filing, email reminders and background monitoring remain outside this account activation. Files are immutable; failed uploads may leave private unreferenced objects. No deletion or cleanup is enabled. Free-plan database and file backups need a separate retention strategy before production use.
