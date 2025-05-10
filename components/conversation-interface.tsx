"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Mic, Send, MicOff, Loader2 } from "lucide-react"
import SallyAvatar from "./sally-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const inputRef = useRef<HTMLInputElement>(null)
  const hasSubmittedTranscript = useRef(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  
  // Generate a conversation ID when the component mounts
  const [conversationId] = useState(() => generateConversationId())
  
  // Custom chat state
  const [messages, setMessages] = useState<Array<{id: string; role: string; content: string}>>([
    {
      id: "1",
      role: "assistant",
      content: `Hello! I'm Sally, the KnowAll.ai assistant. Your conversation ID is ${conversationId}. I'm here to understand your requirements and create an initial brief for our business analysts to follow up on. What AI solution are you interested in exploring?`,
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }
  
  // Set isMounted to true when component mounts on client side
  useEffect(() => {
    setIsMounted(true)
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
      
      // Call our server-side API route
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
      
      if (!response.ok) {
        let errorMessage = 'Failed to get response from chat API';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // Parse the response
      const responseData = await response.json()
      
      // Add the assistant's response to the chat
      const assistantMessage = {
        id: responseData.id || Date.now().toString(),
        role: responseData.role || "assistant",
        content: responseData.content || "I'm sorry, I couldn't process your request.",
      }
      
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat API error:", error)
      setError(error instanceof Error ? error : new Error('An unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  // Set mounted state on client - only once
  useEffect(() => {
    setIsMounted(true)
    
    // Add event listener to prevent form submission from reloading the page
    const preventFormSubmit = (e: Event) => {
      if (e.target instanceof HTMLFormElement) {
        e.preventDefault()
      }
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

      // Only submit if we have a transcript and haven't already submitted it
      if (transcript.trim() && !hasSubmittedTranscript.current) {
        hasSubmittedTranscript.current = true
        setInput(transcript)

        // Use setTimeout to ensure state updates have propagated
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
  
  // Create a client-side only speech recognition component
  const SpeechRecognitionComponent = () => {
    // This is a proper hook call inside a component function
    const speechSupported = useSpeechRecognition({
      isRecording,
      onResult: handleSpeechResult,
      onEnd: handleSpeechEnd,
    })
    
    // Update the speech support state when this component mounts
    // We only set this once to avoid an infinite update loop
    useEffect(() => {
      setIsSpeechSupported(speechSupported)
    }, []) // Empty dependency array to run only once on mount
    
    // This component doesn't render anything
    return null
  }
  
  // Only render the speech recognition component on the client side
  const speechRecognitionElement = isMounted ? <SpeechRecognitionComponent /> : null

  // Update input field with transcript while recording
  useEffect(() => {
    if (isRecording && transcript) {
      setInput(transcript)
    }
  }, [transcript, isRecording])

  // Use a ref to track if we need to scroll to bottom
  const shouldScrollRef = useRef(false)
  const isInitialMount = useRef(true)
  
  // Handle scrolling only when new messages are added
  useEffect(() => {
    // Skip scrolling on initial render
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    // Only scroll when a new message is added (not on initial load)
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
    // Prevent default form submission behavior
    e.preventDefault()
    e.stopPropagation()
    
    // Stop recording if active
    if (isRecording) {
      setIsRecording(false)
    }
    
    // Only proceed if there's input or we're recording
    if (input.trim() || isRecording) {
      // Call our custom handleSubmit function
      handleSubmit(e)
    }
    
    // Return false to ensure no propagation
    return false
  }
  
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
          <div className="h-[400px] p-4 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-lime-500" />
          </div>
        </CardContent>
        <CardFooter className="p-3 border-t border-gray-700">
          <div className="flex w-full gap-2">
            <div className="flex-1 h-10 bg-gray-800 rounded-md" />
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
        <ScrollArea className="h-[400px] p-4">
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
        <form className="flex w-full gap-2" onSubmit={handleFormSubmit}>
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
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
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() && !isRecording}
            className="bg-lime-600 hover:bg-lime-700"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
