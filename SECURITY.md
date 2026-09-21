# Security Policy

## Supported Versions

Security fixes are applied to the latest version on the `master` branch.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through
[GitHub Security Advisories](https://github.com/Agrestor666/10xcards/security/advisories/new).

Include:

- a description of the issue and its potential impact;
- reproducible steps or a minimal proof of concept;
- affected routes, components, or versions;
- any suggested mitigation, if known.

Do not disclose vulnerabilities, credentials, access tokens, personal data, or
other sensitive information in public issues or pull requests.

You should receive an initial response within seven days. Confirmed issues will
be prioritized according to severity, and coordinated disclosure will be agreed
with the reporter.

## Secret Exposure

If a secret is accidentally committed, remove it from active use immediately.
Rotate or revoke it before rewriting Git history, because deleting a value from
the latest commit does not remove it from existing clones or prior commits.
