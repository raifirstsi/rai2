# RAI2 release and staging runbook

## Release boundary

Only a commit on `main` whose `RAI2 SaaS OSS` workflow passed may be tagged.
The release tag is `v<package version>` and is immutable. The tag workflow
rebuilds runtime and SaaS archives, checks each archive in an isolated fixture,
and publishes the archive, SHA-256 file and CycloneDX SBOM together.

The upstream desktop, npm and release-mirror workflows are manual-only. They
are not RAI2 distribution paths.

## Isolated staging

Never point staging verification at production data, SMTP, payments, DNS or a
tenant home. Use the artifact produced by CI and a disposable data directory.

1. Verify the archive with its sibling `.sha256` and `.cdx.json`.
2. Run `scripts/smoke-rai2-package.mjs` and
   `scripts/smoke-rai2-saas-package.mjs` with absolute archive paths.
3. Run `pnpm saas:smoke`; it owns a temporary SQLite database and synthetic
   dependencies, then removes them.
4. Run `pnpm benchmark:rai2-capacity` and retain its JSON output with the
   release evidence.
5. On disposable Linux, run the fleet recipe in
   `docs/verification/fleet.md`. Root-to-tenant, nftables and systemd claims
   are not qualified by a Windows or planner-only run.

## Promotion and rollback

Production promotion requires the approvals in
`compliance/COMMERCIAL_RELEASE_CHECKLIST.md`. Stage the versioned archives
beside the current version, verify their checksums, take an encrypted backup,
and test restoration away from production. Keep the prior archive and service
configuration. Rollback restores the prior version and, only when a migration
changed customer state, the matching verified backup.

Do not overwrite a release tag, reuse an artifact name with different bytes,
or initialize a blank database when the expected database is missing.
