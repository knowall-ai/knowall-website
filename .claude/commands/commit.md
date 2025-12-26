# Commit

Commit changes after verifying code quality and testing.

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
7. Once all checks pass and testing is confirmed:
   - Run `git status` to see changes
   - Run `git diff` to review what will be committed
   - Run `git log --oneline -3` to see recent commit style
   - Create a commit with an appropriate message following the repository's commit style
   - End the commit message with the standard Claude Code footer
