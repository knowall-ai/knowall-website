"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Mic, Send, MicOff, Bot, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useChat } from "ai/react"
import useSpeechRecognition from "./speech-recognition"

export default function ConversationInterface() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasSubmittedTranscript = useRef(false)

  const { messages, input, handleInputChange, handleSubmit, setInput, isLoading } = useChat({
    initialMessages: [
      {
        id: "1",
        role: "assistant",
        content: "Hello! I'm the KnowAll.ai assistant. How can I help you today?",
      },
    ],
  })

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

  // Use speech recognition hook
  const isSpeechSupported = useSpeechRecognition({
    isRecording,
    onResult: handleSpeechResult,
    onEnd: handleSpeechEnd,
  })

  // Update input field with transcript while recording
  useEffect(() => {
    if (isRecording && transcript) {
      setInput(transcript)
    }
  }, [transcript, isRecording])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const toggleRecording = () => {
    if (!isRecording) {
      // Starting recording
      setTranscript("")
      hasSubmittedTranscript.current = false
    }
    setIsRecording(!isRecording)
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isRecording) {
      setIsRecording(false)
    }
    handleSubmit(e)
  }

  return (
    <Card className="w-full shadow-xl border-0 bg-gray-900/90 backdrop-blur-sm">
      <CardHeader className="p-4 border-b border-gray-700 bg-lime-600/90 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <h3 className="font-medium">KnowAll Assistant</h3>
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
                  <p>{message.content}</p>
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
