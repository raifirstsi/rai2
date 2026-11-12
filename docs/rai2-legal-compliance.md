# RAI2 legal and release compliance

This is the engineering compliance policy for RAI2. It is not legal advice or
a substitute for written advice from counsel in the countries where RAI2 is
sold, hosted, or employs people.

## Distribution boundary

RAI2 distributes the Apache-2.0 OpenMausBot core and RAI FIRST's own changes.
The separately licensed OpenMausBot `enterprise/` implementation is not part
of the RAI2 source tree, runtime, SaaS bundle, Docker image, npm package, or
customer-hosted distribution. RAI2 must not copy, modify, host, resell, or
white-label that implementation without a written agreement from its copyright
holder.

The core loader in `server/enterprise.ts` is Apache-2.0 code and may remain. It
must report the OSS edition when no separately licensed implementation exists.

## Automated gate

Run before every release:

```sh
pnpm compliance:rai2
pnpm saas:check
pnpm saas:test
pnpm saas:smoke
pnpm package:rai2
```

The compliance check fails when restricted source or asset-download scratch
files are present; LICENSE, NOTICE, dependency licences, modification records,
or the asset rights inventory drift; or a production dependency introduces an
unreviewed licence expression. `compliance/dependency-licenses.json` inventories
the pnpm production graph. It is deliberately not called an artifact SBOM.

Every shipped archive must contain LICENSE, NOTICE, the relevant third-party
licence texts, a checksum, and a sibling `.cdx.json` artifact-specific
CycloneDX SBOM generated from the final archive contents. The package smoke
checks the SBOM's archive hash and OSS-only marker. Release approval stays
blocked until the SBOM matches the archive rather than merely the source
dependency graph.

## Apache obligations

- Keep the complete Apache-2.0 LICENSE with source and object distributions.
- Keep OpenMausBot copyright and attribution notices in NOTICE.
- Keep `compliance/MODIFIED_FILES.md` current and include it in source and
  binary distributions. Counsel must confirm whether this mechanism and the
  notices in the distributed form satisfy Apache-2.0 section 4(b) for that
  release; add per-file notices where counsel requires them.
- Preserve relevant upstream and third-party notices. New dependencies and
  copied code require provenance and licence review before merge.
- Do not state or imply that OpenMausBot or its contributors endorse RAI2.

## Assets and trademarks

`compliance/assets.json` is the public asset inventory. The corresponding
contracts, author assignments, generation records, source files, and purchase
receipts belong in RAI FIRST's private IP register. An operator attestation in
the public inventory is not a substitute for that evidence.

RAI2 branding must be distinct from OpenMausBot branding. Apache-2.0 grants no
trademark rights. Product names, domains, logos, mascots, screenshots, provider
marks, and marketing claims require a trademark and asset review before launch
in a new country.

## Customer-hosted and BYOC

A customer-hosted distribution is still a distribution. Ship only the OSS
boundary described above unless RAI FIRST has a written commercial agreement
covering additional code. Customer terms must identify the Apache-2.0
components, RAI FIRST support obligations, third-party model providers, update
policy, telemetry, security responsibilities, and data/backup ownership.

## Public history remediation

The public `raifirstsi/bot` history has contained the separately licensed
`enterprise/` source. Removing it from the current tree stops new tip releases
from carrying it but does not erase earlier Git objects, forks, caches, or
clones. Before commercial expansion, counsel and the copyright holder must
choose and document one path:

1. obtain a written partner agreement covering the historical and future use;
2. publish a clean RAI2 repository whose history never contains the restricted
   implementation, then archive the old repository; or
3. perform a coordinated history rewrite and force-push, understanding that it
   cannot recall copies already downloaded.

Do not rewrite or force-push public history as an ordinary release step.

## Release approval

Technical checks are necessary but not a legal sign-off. A commercial release
requires recorded approval for source licences, artifact SBOM, asset ownership,
trademarks, privacy policy, customer terms, data processing terms, security
claims, tax/payment obligations, and the jurisdictions in which it is offered.
