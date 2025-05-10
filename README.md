# KnowAll.ai Website

This repository contains the code for the KnowAll.ai website, an AI consultancy specializing in agent development, Microsoft Copilots, and Bitcoin-powered value-for-value transactions.

## Features

- Modern, responsive design with dark mode
- Interactive AI chat assistant powered by OpenAI's GPT-4o
- Speech recognition for voice input in the chat interface
- Sections highlighting KnowAll.ai's services and projects
- Information about Zapp.ie, an open-source platform for Bitcoin microtransactions
- Details about Microsoft Copilot development and multi-agent teams

## Technologies Used

- **Next.js**: React framework with App Router
- **TypeScript**: For type-safe code
- **Tailwind CSS**: For styling
- **shadcn/ui**: Component library
- **OpenAI API**: For the chat assistant
- **Vercel**: For deployment

## Getting Started

### Prerequisites

- Node.js 22.x or later
- pnpm (automatically enabled via Corepack in Node.js 22+)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/knowall-ai/website.git
   cd website
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the website.

## Environment Variables

### Local Development

For local development, create a `.env.local` file in the root directory with the following variables:

```
OPENAI_API_KEY=your_openai_api_key_here
ADMIN_API_KEY=your_admin_api_key_here
```

Make sure to replace the placeholder values with your actual API keys.

### Troubleshooting Chat Functionality

If you're experiencing issues with the chat functionality not responding:

1. Verify that your OpenAI API key is valid and has sufficient quota
2. Check the browser console for any API-related errors
3. Ensure the API key is correctly set in your environment variables
4. For local development, restart the development server after updating the `.env.local` file

## Deployment

The website is deployed on Azure Static Web Apps. Any push to the master branch will trigger a new deployment via GitHub Actions.

### Azure Static Web Apps Configuration

The deployment uses the following environment variables that must be set in the GitHub repository secrets:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: The deployment token for Azure Static Web Apps
- `OPENAI_API_KEY`: Your OpenAI API key for the chat functionality

These secrets are configured in the GitHub repository under Settings > Environments > Production - Azure.

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) configures these environment variables for the deployed application.

### Environment Variables

The following environment variables need to be set in the "Production - Azure" GitHub environment:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: The deployment token for Azure Static Web Apps
- `OPENAI_API_KEY`: Your OpenAI API key for the chat functionality
- `ADMIN_API_KEY`: Your admin API key for accessing the chat logs in production

### Deployment Process

1. Make your changes locally
2. Commit and push to the master branch:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin master
   ```
3. GitHub Actions will automatically build and deploy the site to Azure
4. You can monitor the deployment in the Actions tab of your GitHub repository

## Project Structure

- `app/`: Next.js App Router pages and API routes
- `components/`: Reusable React components
- `public/`: Static assets like images
- `types/`: TypeScript type definitions
- `hooks/`: Custom React hooks
- `lib/`: Utility functions

## Key Components

- `ConversationInterface`: Interactive chat interface with speech recognition
- `ServiceCard`: Cards displaying KnowAll.ai's services
- `BackgroundImage`: Component for handling background images with loading states
- `Logo`: KnowAll.ai logo with dark mode support
- `Header` and `Footer`: Site navigation and information

## Chat Logging System

The website includes a comprehensive chat logging system that records all conversations between users and the AI assistant. This helps in monitoring user interactions and improving the assistant's responses over time.

### How It Works

1. Every chat interaction is automatically logged to a JSON file stored in a `logs` directory at the root of the project
2. Each log entry includes the user message, assistant response, timestamp, and user metadata
3. Logs can be accessed through a secure admin interface

### Accessing Chat Logs

To view the chat logs:

1. Visit `/admin/logs` in your browser
2. Authenticate with your admin API key
3. Browse through the conversation history

### Security

The logs admin interface is protected with API key authentication. Make sure to set a secure `ADMIN_API_KEY` in your environment variables.

## Security Architecture

### API Key Management

The KnowAll.ai website follows security best practices for handling API keys:

1. **Server-Side API Calls**: All calls to external APIs (like OpenAI) are made from server-side API routes, never from the client side. This ensures API keys are never exposed to users.

2. **Environment Variables**: API keys are stored as environment variables:
   - Development: `.env.local` file (not committed to the repository)
   - Production: GitHub Secrets and Azure Static Web Apps configuration

3. **Authentication for Admin Features**: The admin interface (chat logs) is protected with a separate `ADMIN_API_KEY` that is different from the OpenAI API key.

4. **No Client-Side Exposure**: The architecture ensures that sensitive keys are never:
   - Included in client-side JavaScript bundles
   - Exposed in browser network requests
   - Visible in the application source code

### Security Best Practices

- **Rate Limiting**: The API routes implement basic rate limiting to prevent abuse
- **Error Handling**: Errors are logged server-side but only generic messages are returned to clients
- **Input Validation**: All user inputs are validated before processing
- **Secure Headers**: API responses use appropriate security headers

### Architecture Diagram

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│             │      │             │      │             │
│  Browser    │──────▶  Next.js    │──────▶  OpenAI     │
│  Client     │      │  API Route  │      │  API        │
│             │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            │
                     ┌──────▼──────┐
                     │             │
                     │  Chat Logs  │
                     │  Storage    │
                     │             │
                     └─────────────┘
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

KnowAll.ai - [hello@knowall.ai](mailto:hello@knowall.ai)

Project Link: [https://github.com/knowall-ai/website](https://github.com/knowall-ai/website)
