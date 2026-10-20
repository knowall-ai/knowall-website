# Contributing to the KnowAll website

Thanks for helping. This is the [KnowAll AI](https://knowall.ai) website.

## Keep company and personal information out

This repository may become public, so treat everything you add as if the whole internet will read it. That covers code, comments, docs, tests, fixtures, PR titles and descriptions, commit messages and screenshots.

**Never commit:**

- real people's names, email addresses or phone numbers
- client or prospect names, or deal details
- prices, contract terms or pipeline data
- tenant IDs, company IDs, app/client IDs, host names, VM names or admin account names
- secrets of any kind (gitleaks checks for these in CI, but it will not catch the rest)

**Do this instead:**

- Put real values in git-ignored config files, environment variables or deploy settings. Keep an `.env.example` with placeholders only.
- Use `example.com` / `example.org` addresses and fictional names (Contoso, Fabrikam, Sam Ortiz) in tests and fixtures.
- For Business Central data, use the CRONUS demo company.
- Take screenshots with demo data only, and check the browser tab, URL bar and notifications too.

**If something slips in:** say so in the PR, remove it, and rotate it if it is a secret. Git history keeps what was committed, even after you delete it. Rewriting history needs a maintainer, so ask rather than force-pushing a shared branch.

The website is public by nature, so also check page copy, metadata, sample chat conversations and `public/` assets for anything that names a real client or person.

## Making a change

1. Read [CLAUDE.md](CLAUDE.md) for the architecture and conventions.
2. Create a branch from `master` and keep the pull request small and focused.
3. Run `npm install`, then `npm run lint`, `npm run format:check` and `npm run test:unit`. Add tests where they fit.
4. Open a pull request against `master` using the template: conventional-commit title, Summary, Fixes, Test plan. Say what changed and why.
5. For visual changes, add screenshots using demo data only.
6. CI must pass before merge.
