# Push

Push changes to remote after verifying code quality and testing.

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
8. Once all checks pass and testing is confirmed:
   - Run `git push` to push to the remote
   - Confirm the push was successful
9. Monitor the GitHub Actions workflows in the background:
   - Run `gh run list --limit 1` to get the latest workflow run ID
   - Run `scripts/watch-workflow.sh <run-id>` in the background (using `run_in_background: true`)
   - Tell the user the workflow is being monitored in the background and they can continue working
