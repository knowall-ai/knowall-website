# Create Pull Request

Create a pull request after verifying code quality and testing.

## Instructions

1. Run `npm run lint` and ensure it passes
2. Run `npm run format:check` and ensure it passes
3. If either check fails, fix the issues before proceeding
4. Check if the dev server is running on port 3000 using `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
5. If the dev server is running:
   - Use the Claude Code Chrome extension to open http://localhost:3000 in Edge
   - Visually verify the changes work correctly in the browser
   - Take a screenshot to confirm
6. If the dev server is NOT running:
   - Ask the user: "The dev server isn't running. Have you tested these changes in the browser? (yes/no)"
   - Only proceed if the user confirms yes
7. Check if there are uncommitted changes using `git status`
   - If there are uncommitted changes, run `/commit` first
8. Check if local commits need to be pushed using `git status`
   - If there are unpushed commits, push them first
9. Get context for the PR:
   - Run `git log origin/master..HEAD --oneline` to see commits that will be in the PR
   - Run `git diff origin/master...HEAD --stat` to see files changed
10. Create the pull request:
    - Use `gh pr create` with a descriptive title and body
    - The body should include:
      - Summary of changes (based on commits)
      - Test plan (how changes were verified)
      - Standard Claude Code footer
11. Monitor the GitHub Actions workflows on the PR:
    - Run `gh run list --limit 1` to get the latest workflow run
    - Wait for the workflow to complete
    - If the workflow fails, show the error logs
    - Report the final status to the user
12. Return the PR URL to the user
