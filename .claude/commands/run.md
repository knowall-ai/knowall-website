# Run Dev Server

Start the Next.js development server in the background.

## Instructions

1. Check if something is already running on port 3000 using `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
2. If port 3000 is in use:
   - Check what's running there
   - If it's the KnowAll website, inform the user it's already running
   - If it's something else, try ports 3001, 3002, etc. until finding a free one
3. Start the dev server in the background using `npm run dev` (with run_in_background: true)
4. Wait a few seconds for the server to start
5. Verify the server is running by checking the port
6. Report the URL to the user (e.g., http://localhost:3000)
