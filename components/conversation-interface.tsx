"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, Send, MicOff, Loader2 } from "lucide-react"
import SallyAvatar from "./sally-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Import the speech recognition hook directly
// We'll handle client-side rendering in the component
import useSpeechRecognition from "./speech-recognition"

// Generate a unique conversation ID
function generateConversationId() {
  // Generate a random string of 8 characters (letters and numbers)
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export default function ConversationInterface() {
  // Track if we're on the client side
  const [isMounted, setIsMounted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasSubmittedTranscript = useRef(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  
  // Generate a conversation ID when the component mounts
  const [conversationId] = useState(() => generateConversationId())
  
  // Custom chat state
  const [messages, setMessages] = useState<Array<{id: string; role: string; content: string}>>([
    {
      id: "1",
      role: "assistant",
      content: `I'm Sally, but I'm not your regular bot. My aim is to understand what you want to achieve and understand if we are a good fit to help you. If we are, I can create a brief for the team if you would like me to.

Our conversation will be saved with the ID of ${conversationId} for future reference so you won't need to repeat it.

So, what challenge are you trying to solve?`,
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }
  
  // Set isMounted to true when component mounts on client side
  useEffect(() => {
    setIsMounted(true)
    
    // Add global error handler to catch unhandled errors
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      console.error('Error message:', event.message);
      console.error('Error source:', event.filename, 'line:', event.lineno, 'col:', event.colno);
    };
    
    // Add unhandled rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      console.error('Promise rejection stack:', event.reason?.stack);
    };
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Run a diagnostic test on the API endpoint
    const runApiTest = async () => {
      try {
        console.log('Running API diagnostic test...');
        // Use a GET request with a simple flag parameter for diagnostics only
        // This is better than HEAD which might not be supported by the API
        const testResponse = await fetch('/api/chat?diagnostic=true', {
          method: 'GET',
        });
        console.log('API test status:', testResponse.status, testResponse.statusText);
        console.log('API test headers:', Object.fromEntries(testResponse.headers.entries()));
        console.log('API connection test successful');
      } catch (testError) {
        console.error('API test error:', testError);
      }
    };
    
    // Run the test
    runApiTest();
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [])
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!input.trim()) return
    
    // Add user message to the chat
    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }
    
    setMessages((prev) => [...prev, userMessage])
    setInput("") // Clear input
    setIsLoading(true)
    setError(null)
    
    try {
      // Prepare messages for the API
      const apiMessages = [
        ...messages.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })),
        {
          role: userMessage.role as "user",
          content: userMessage.content
        }
      ]
      
      console.log('Sending chat request with conversation ID:', conversationId)
      
      let responseData;
      try {
        // Call our server-side API route with error handling
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages: apiMessages,
            conversationId: conversationId 
          }),
        })
        
        // Log the actual response for debugging
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
          let errorMessage = `Failed to get response from chat API: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            console.error('Error response data:', errorData);
            errorMessage = errorData.error || errorMessage;
          } catch (parseError) {
            console.error('Error parsing response:', parseError);
          }
          throw new Error(errorMessage);
        }
        
        // Parse the response data
        responseData = await response.json();
      } catch (fetchError: unknown) {
        console.error('Fetch operation failed:', fetchError);
        const errorMessage = fetchError instanceof Error 
          ? `Network error: ${fetchError.message}` 
          : 'Unknown network error';
        throw new Error(errorMessage);
      }
      
      // Use the response data from the try block
      const data = responseData;
      
      console.log('API response data:', data);
      
      // Add the assistant's response to the chat
      // Check for various possible field names where the content might be
      const responseContent = data.response || data.content || data.message || data.assistantResponse;
      
      if (responseContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: responseContent,
          },
        ])
      } else {
        console.error('Response data structure:', data);
        throw new Error('No response content received');
      }
    } catch (err) {
      console.error('Error in chat submission:', err);
      console.error('Error type:', typeof err);
      console.error('Error properties:', Object.keys(err || {}));
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setIsLoading(false)
    }
  }

  // Set mounted state on client - only once
  useEffect(() => {
    setIsMounted(true)
  }, [])
    
  // Add event listener to prevent form submission from reloading the page
  useEffect(() => {
    const preventFormSubmit = (e: Event) => {
      e.preventDefault()
      return false
    }
    
    document.addEventListener('submit', preventFormSubmit)
    
    return () => {
      document.removeEventListener('submit', preventFormSubmit)
    }
  }, [])

  // Handle speech recognition results
  const handleSpeechResult = (result: string) => {
    setTranscript(result)
  }

  // Handle speech recognition end
  const handleSpeechEnd = () => {
    if (isRecording) {
      setIsRecording(false)
      
      // If there's a transcript and we haven't submitted it yet,
      // set it as input and submit the form
      if (transcript && !hasSubmittedTranscript.current) {
        hasSubmittedTranscript.current = true
        setInput(transcript)
        
        setTimeout(() => {
          const fakeEvent = {
            preventDefault: () => {},
          } as React.FormEvent<HTMLFormElement>
          handleSubmit(fakeEvent)
          setTranscript("")
          hasSubmittedTranscript.current = false
        }, 100)
      }
    }
  }
  
  // TEMPORARILY DISABLED SPEECH RECOGNITION TO FIX INFINITE LOOP
  const speechRecognitionElement = null;
  
  // Set speech recognition as not supported for now
  useEffect(() => {
    setIsSpeechSupported(false);
  }, []);

  // Update input field with transcript while recording
  useEffect(() => {
    if (isRecording && transcript) {
      setInput(transcript)
    }
  }, [isRecording, transcript])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 1) {
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [messages.length]) // Only run when the message count changes

  const toggleRecording = () => {
    if (!isRecording) {
      // Starting recording
      setTranscript("")
      hasSubmittedTranscript.current = false
    }
    setIsRecording(!isRecording)
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form submit triggered');
    
    try {
      if (isRecording) {
        // If we're recording speech, stop recording and submit what we have
        setIsRecording(false);
        hasSubmittedTranscript.current = true; // Mark that we're submitting from transcript
        handleSubmit(e);
      } else {
        // Otherwise just submit the text input
        if (input.trim()) {
          console.log('Submitting text input:', input.trim());
          handleSubmit(e);
        } else {
          console.log('Empty input, not submitting');
        }
      }
    } catch (formError) {
      console.error('Form submission wrapper error:', formError);
      setError(formError instanceof Error ? formError : new Error('Unknown form submission error'));
      setIsLoading(false);
    }
  };
  
  // Show a placeholder during SSR and initial client render
  if (!isMounted) {
    return (
      <Card className="w-full shadow-xl border-0 bg-gray-900/90 backdrop-blur-sm">
        <CardHeader className="p-4 border-b border-gray-700 bg-lime-600/90 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <SallyAvatar className="h-10 w-10" size={40} />
            <h3 className="font-medium">Sally</h3>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[480px] p-4 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
          </div>
        </CardContent>
        <CardFooter className="p-3 border-t border-gray-700">
          <div className="flex w-full gap-2">
            <div className="flex-1 min-h-[60px] bg-gray-800 rounded-md" />
            <div className="w-10 h-10 rounded-md bg-gray-800" />
            <div className="w-10 h-10 rounded-md bg-lime-600" />
          </div>
        </CardFooter>
      </Card>
    )
  }

  // Render the full component when on client side
  return (
    <Card className="w-full shadow-xl border-0 bg-gray-900/90 backdrop-blur-sm">
      {/* Include the speech recognition component */}
      {speechRecognitionElement}
      
      <CardHeader className="p-4 border-b border-gray-700 bg-lime-600/90 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <SallyAvatar className="h-10 w-10" size={40} />
          <h3 className="font-medium">Sally</h3>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[480px] p-4">
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-3 max-w-[80%]", message.role === "user" ? "ml-auto" : "mr-auto")}
              >
                <div
                  className={cn(
                    "rounded-lg p-3",
                    message.role === "user" ? "bg-lime-600 text-white" : "bg-gray-800 text-gray-100",
                  )}
                >
                  {message.role === "user" ? (
                    <p>{message.content}</p>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a 
                            {...props} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:underline"
                          />
                        ),
                        p: ({ node, children, ...props }) => (
                          <p className="mb-2" {...props}>{children}</p>
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="rounded-lg p-3 bg-gray-800 text-gray-100">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            {error && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="rounded-lg p-3 bg-red-600/80 text-white">
                  <p className="font-medium">I'm sorry, something went wrong.</p>
                  <p className="text-sm mt-1">{error.message}</p>
                </div>
              </div>
            )}
            {isRecording && (
              <div className="flex gap-3 max-w-[80%] ml-auto">
                <div className="rounded-lg p-3 bg-lime-600/70 text-white flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p>{transcript || "Listening..."}</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-3 border-t border-gray-700">
        <form className="flex w-full gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            // Direct form submission
            const userMsg = input.trim();
            // Add user message to UI immediately
            const userMessage = {
              id: Date.now().toString(),
              role: "user",
              content: userMsg,
            };
            setMessages(prev => [...prev, userMessage]);
            setInput("");
            setIsLoading(true);
            
            // Simple fetch with minimal complexity
            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  ...messages.map(msg => ({ role: msg.role, content: msg.content })),
                  { role: userMessage.role, content: userMessage.content }
                ],
                conversationId: conversationId
              })
            })
            .then(response => response.json())
            .then(data => {
              // Add response to UI
              setMessages(prev => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: "assistant",
                  content: data.content || "Sorry, I couldn't process that.",
                }
              ]);
            })
            .catch(err => {
              console.error("Raw fetch error:", err);
              setError(new Error(err.message || "Failed to communicate with the server"));
            })
            .finally(() => {
              setIsLoading(false);
            });
          }
        }}>
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={(e) => handleInputChange(e as any)}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleFormSubmit(e as any);
              }
            }}
            disabled={isLoading}
          />
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "outline"}
            onClick={toggleRecording}
            className={isRecording ? "animate-pulse border-gray-700" : "border-gray-700"}
            disabled={!isSpeechSupported}
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-gray-300" />}
          </Button>
          <div className="flex flex-col">
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() && !isRecording}
              className="bg-lime-600 hover:bg-lime-700"
              onClick={() => {
                // Add direct client-side debugging
                console.log('Send button clicked directly');
                // Attempt to capture any client-side network status
                if (!navigator.onLine) {
                  console.error('Browser reports device is offline');
                  setError(new Error('Please check your internet connection'));
                  return;
                }
              }}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  )
}
