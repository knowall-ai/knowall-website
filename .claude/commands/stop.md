# Stop Dev Server

Stop the Next.js development server running in the background.

## Instructions

1. Check if something is running on port 3000 using `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
2. If nothing is running (connection refused or non-200 response):
   - Inform the user that no dev server appears to be running on port 3000
3. If the server is running:
   - Find the process using port 3000 with `lsof -ti:3000`
   - Kill the process(es) using `kill $(lsof -ti:3000)`
   - Verify the server has stopped by checking the port again
   - Report success to the user
4. If there are issues killing the process:
   - Try `kill -9 $(lsof -ti:3000)` for a force kill
   - Report any errors to the user
