import { OpenAI } from "openai";
import { systemPrompt } from "./system-prompt";
import { logChat } from "./logger";

// Configure for static export
export const runtime = "nodejs";

// For static export, we need to use these specific settings
export const dynamic = 'error';
export const dynamicParams = false;
export const revalidate = false;

export async function POST(req: Request) {
  try {
    // Parse the request body to get the messages and conversation ID
    const body = await req.json();
    const conversationId = body.conversationId || Date.now().toString();
    
    // Validate the API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('API key exists:', !!apiKey);
    console.log('API key length:', apiKey ? apiKey.length : 0);
    
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not available");
    }
    
    // Initialize the OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Prepare messages for the OpenAI API and replace placeholders with actual values
    const customizedSystemPrompt = systemPrompt.replace(/\{\{CONVERSATION_ID\}\}/g, conversationId);
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: "system",
        content: customizedSystemPrompt
      }
    ];
    
    // Add the user messages from the request
    if (body.messages && Array.isArray(body.messages)) {
      // Map the messages to the format expected by OpenAI
      const userMessages = body.messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as string
      }));
      
      messages.push(...userMessages);
    }
    
    console.log('Sending messages to OpenAI:', JSON.stringify(messages, null, 2));
    
    let responseContent = "";
    
    try {
      // Try to get a response from the OpenAI API
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Using a more standard model that should be available
        messages: messages,
        max_tokens: 500,
      });
      
      responseContent = response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
      
      // Extract the user's message for logging
      let userMessage = "";
      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage.role === 'user') {
          userMessage = lastMessage.content;
        }
      }
      
      // Log the successful conversation
      await logChat(userMessage, responseContent, conversationId, req);
    } catch (apiError) {
      console.error("OpenAI API error:", apiError);
      
      // Fallback to a static response
      console.log("Using fallback static response");
      
      // Extract the user's message to personalize the fallback response
      let userMessage = "";
      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage.role === 'user') {
          userMessage = lastMessage.content;
        }
      }
      
      // Create a fallback response that includes the first sentence of the system prompt
      const firstSentence = systemPrompt.split('.')[0] + '.';
      responseContent = `I received your message: "${userMessage}". However, I'm currently experiencing some technical difficulties connecting to my knowledge base. ${firstSentence} Please try again later or contact us directly for more information about our services.`;
      
      // Log the fallback conversation
      await logChat(userMessage, responseContent, conversationId, req);
    }
    
    // Create a response in the format expected by our custom implementation
    const responseMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: responseContent,
      conversationId: conversationId
    };
    
    // Return the response as JSON
    return new Response(JSON.stringify(responseMessage), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error("Error in OpenAI chat API:", error);
    
    // Log detailed error information
    console.error("Full error object:", JSON.stringify(error, null, 2));
    
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      // For OpenAI API errors, log more specific information
      if ('status' in error && typeof error.status === 'number') {
        if (error.status === 401) {
          console.error("Authentication error: Invalid API key or unauthorized access");
        } else if (error.status === 429) {
          console.error("Rate limit error: Too many requests to the OpenAI API");
        } else if (error.status === 500) {
          console.error("Server error: OpenAI API service is experiencing issues");
        }
      }
    }
    
    // Log request information
    try {
      console.error("Request information:", {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries())
      });
    } catch (e) {
      console.error("Error logging request information:", e);
    }
    
    // Determine the appropriate error message for the client
    let clientErrorMessage = "An error occurred in the chat API. Please try again.";
    
    if (error instanceof Error) {
      // For OpenAI API errors, provide specific but clean messages
      if ('status' in error && typeof error.status === 'number') {
        if (error.status === 401) {
          clientErrorMessage = "Authentication error: Please check your API key";
        } else if (error.status === 429) {
          clientErrorMessage = "Rate limit exceeded: Please try again later";
        } else if (error.status === 500) {
          clientErrorMessage = "OpenAI server error: Please try again later";
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        error: clientErrorMessage,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
