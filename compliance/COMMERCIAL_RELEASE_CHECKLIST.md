# RAI2 commercial release approval

This record separates engineering evidence from approvals that require the
RAI FIRST operator or qualified counsel. An unchecked item blocks a commercial
launch; it does not block an engineering prerelease used in isolated fixtures.

## Engineering evidence

- [x] Clean public repository has no ref to the archived enterprise-bearing branch.
- [x] Runtime and SaaS distributions exclude restricted enterprise source.
- [x] LICENSE, NOTICE, modification inventory and reviewed dependency inventory are shipped.
- [x] Every archive has a SHA-256 checksum and artifact-specific CycloneDX SBOM.
- [x] Authentication, tenant, payment-disabled, fleet planning and package smoke gates run in isolated fixtures.
- [x] Backup and rollback procedure is documented.
- [x] Capacity evidence distinguishes control-plane planning from real Linux runtime qualification.

## Operator records required before taking customers

- [ ] RAI FIRST legal entity, contracting address and tax registrations recorded privately.
- [ ] Asset register contains author assignments, source files, purchase receipts and trademark search evidence.
- [ ] Privacy Policy, Terms of Service and Data Processing Agreement approved for the launch jurisdictions.
- [ ] Subprocessor list, model-provider data paths and international-transfer basis approved.
- [ ] Data retention, deletion, backup ownership and breach-notification periods approved.
- [ ] Security claims and customer-facing SLA reviewed against measured operations.
- [ ] Payment, invoicing, refund and consumer-protection obligations approved.
- [ ] Apache-2.0 section 4 notice treatment and LGPL binary obligations reviewed by qualified counsel.

## Production acceptance required for each host

- [ ] Dedicated staging host passes the Linux fleet isolation recipe.
- [ ] Encrypted backup restores successfully on a different disposable host.
- [ ] Monitoring covers control-plane health, tenant health, provisioning errors, storage and backup age.
- [ ] Secrets are unique per environment, stored outside Git, rotated and recoverable by two authorized operators.
- [ ] First real payment and workspace provisioning are observed with an approved rollback window.
- [ ] Capacity limits are set from measured CPU, RAM, storage and connection headroom on that exact host.

Release approver: ____________________  Date: __________

Legal approver: ______________________  Date: __________

Security/operations approver: ________  Date: __________
