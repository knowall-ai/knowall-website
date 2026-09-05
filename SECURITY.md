# Security Policy

## Reporting a Vulnerability

We take the security of the KnowAll AI website seriously. It is our public face,
it fronts Sallie's public chat and voice APIs, and its shop takes Bitcoin
Lightning payments, so security reports are treated with the highest priority.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities privately through one of these channels:

| Channel              | Details                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| Email                | [support@knowall.ai](mailto:support@knowall.ai)                               |
| Nostr (encrypted DM) | `npub1jutptdc2m8kgjmudtws095qk2tcale0eemvp4j2xnjnl4nh6669slrf04x` (Ben Weeks) |

When reporting, please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept requests or code are welcome)
- The component affected (see **Scope** below)
- Any suggested remediation, if you have one

## What to Expect

- **Acknowledgement** within 3 working days of your report.
- **Assessment and triage** — we will confirm the issue, assess severity, and
  keep you informed of progress.
- **Fix and disclosure** — we aim to remediate confirmed vulnerabilities
  promptly and will credit reporters (with permission) once a fix is released.

We ask that you practise responsible disclosure: give us reasonable time to fix
the issue before any public disclosure, and do not access, modify, or exfiltrate
data (or funds) beyond what is necessary to demonstrate the vulnerability.
Please do not run automated scanners or load tests against
[www.knowall.ai](https://www.knowall.ai) — a proof of concept is enough.

## Scope

In scope: this repository and its deployment at
[www.knowall.ai](https://www.knowall.ai). Of particular interest:

- Exposure of server-side secrets (`OPENAI_API_KEY`, `ADMIN_API_KEY`, Azure
  deployment credentials) through the client bundle, responses, or logs
- Authentication or authorisation bypass on the admin chat-log endpoint
  (`/api/logs`) or the shop's owner-only listing controls
- Prompt injection, data exfiltration, or abuse paths through Sallie's public
  `/api/chat` and `/api/speak` endpoints — Sallie is deliberately **not**
  connected to any internal system, so a way to reach one would be a serious
  finding
- Anything affecting Lightning payments or order data in the shop checkout
- Cross-site scripting or injection via user-supplied content rendered on the
  site (chat replies, Nostr profiles, comments, story notes)
- Server-side request forgery or path traversal in any API route

Out of scope:

- Findings in third-party services we rely on (OpenAI, GitHub, Azure, Nostr
  relays, LNbits) — please report those to the provider
- Rate-limit or cost-exhaustion reports against the public chat and voice
  endpoints where the only impact is our API bill (we know; a fix is tracked)
- Missing best-practice headers with no demonstrated exploit, and clickjacking
  on pages with no sensitive actions

## Supported Versions

Security fixes are applied to the `master` branch and shipped in the next
tagged release, which deploys straight to production. There are no maintained
older versions.

## Related

- The README's **Security Architecture** section describes how API keys and
  admin access are handled.
- Machine-readable contact details are published at
  [`/.well-known/security.txt`](https://www.knowall.ai/.well-known/security.txt).
