# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please report it responsibly by opening a GitHub issue titled `Security vulnerability report` or by contacting the maintainers directly.

Do not include sensitive information such as exploit details in a public issue if you believe it could be abused before a fix is available.

## Supported Versions

This repository currently supports the latest development branch. Security fixes are backported to the current active branch when appropriate.

## Security Response Process

1. Report the issue privately if possible.
2. Maintainers will acknowledge receipt within 3 business days.
3. The issue will be assessed for severity and assigned to a maintainer.
4. A fix or mitigation will be prepared and reviewed.
5. A public disclosure will be made once a fix is available.

## Reporting Contacts

- Preferred: open a GitHub issue labeled `security`
- Alternative: maintainers via repository contact information

## Security Best Practices

- Keep all dependencies up to date.
- Avoid committing secrets, API keys, or credentials to the repository.
- Use `.env.example` for configuration samples and keep actual secrets out of source control.
