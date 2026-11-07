# Private project storage activation

Status: adapter and migration implemented; no Supabase project/account/database has been provisioned and no live RLS test has passed. Local storage remains the active default. Do not advertise team storage or cloud persistence as live.

1. Provision an explicitly authorized Supabase project and authentication users. Apply `db/project-storage.sql` once. The schema enables row-level security for owner-only records and immutable owner-prefixed private files.
2. Configure `CORNERPIN_SUPABASE_URL` and `CORNERPIN_SUPABASE_ANON_KEY` in the deployment. Only the publishable/anonymous key is accepted. Never configure a service-role key as the public key.
3. Enable the intended Supabase authentication policy and account provisioning path. The supplied client signs in existing accounts; it does not create accounts or accept agreements.
4. Run live access tests with two distinct test accounts: B cannot list/read/update A's project or files, anonymous reads fail, stale revisions cannot overwrite, existing immutable files cannot be changed, and a restored backup passes every checksum.
5. Verify token expiry and sign-out. Tokens remain in browser memory; full backups contain no tokens.
6. Verify a complete project can be restored on a separate browser. Existing local projects are never overwritten by restore. The backup includes all project-document bytes; legacy checklist originals remain in their source store after migration.

Cloud sync is explicit. The data continues to live locally until the user saves a private cloud copy. Immutable source files can be uploaded before a metadata save; a failed metadata save may leave an unreferenced private object. Configure retention/cleanup only after agreeing on a policy; no automatic deletion is enabled.

This adapter is owner-only. Team invitations, organization permissions, billing, city connections and background monitoring are not enabled by this schema.
