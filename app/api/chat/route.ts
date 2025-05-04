import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"

// Create an OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.V0_WEBSITE_KEY,
})

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { messages } = await req.json()

  // Add system message to provide context about KnowAll.ai
  const systemMessage = {
    role: "system",
    content: `You are the KnowAll.ai assistant. KnowAll.ai is an AI consultancy that specializes in building AI agents, 
    developing Microsoft Copilots, and creating value-for-value systems using Bitcoin for agent-to-agent transactions. 
    Their open-source project Zapp.ie enables AI agents to communicate and transact with each other using Bitcoin.
    Be helpful, informative, and concise in your responses. If asked about services, mention AI consultancy, 
    Microsoft Copilot development, and agent-to-agent Bitcoin transactions.`,
  }

  // Add the system message at the beginning of the conversation
  const augmentedMessages = [systemMessage, ...messages]

  // Request the OpenAI API for the response
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: augmentedMessages,
    max_tokens: 500,
  })

  // Convert the response into a friendly text-stream
  const stream = OpenAIStream(response)

  // Return a StreamingTextResponse, which can be consumed by the client
  return new StreamingTextResponse(stream)
}
