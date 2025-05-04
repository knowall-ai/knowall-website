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

- Node.js 18.x or later
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/knowall-ai/website.git
   cd website
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
   \`\`\`
   OPENAI_API_KEY=your_openai_api_key_here
   \`\`\`

4. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the website.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required for the chat functionality)

## Deployment

The website is deployed on Vercel. Any push to the main branch will trigger a new deployment.

To deploy your own instance:

1. Fork this repository
2. Create a new project on Vercel
3. Connect your forked repository
4. Add the required environment variables
5. Deploy

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
