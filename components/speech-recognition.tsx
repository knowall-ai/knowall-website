"use client"

import { useState, useEffect, useRef } from "react"

interface SpeechRecognitionProps {
  isRecording: boolean
  onResult: (transcript: string) => void
  onEnd: () => void
}

export default function useSpeechRecognition({ isRecording, onResult, onEnd }: SpeechRecognitionProps) {
  const recognitionRef = useRef<any>(null)
  const [isSupported, setIsSupported] = useState(false)

  // Initialize speech recognition only once
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = true
        recognitionInstance.interimResults = true
        recognitionInstance.lang = "en-US"

        recognitionInstance.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result) => result.transcript)
            .join("")

          onResult(transcript)
        }

        recognitionInstance.onend = () => {
          onEnd()
        }

        recognitionRef.current = recognitionInstance
        setIsSupported(true)
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore errors when stopping
        }
      }
    }
  }, []) // Empty dependency array to run only once

  // Handle recording state changes
  useEffect(() => {
    if (!recognitionRef.current || !isSupported) return

    if (isRecording) {
      try {
        recognitionRef.current.start()
      } catch (error) {
        // Recognition might already be started
        console.log("Recognition already started")
      }
    } else {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        // Recognition might not be started
        console.log("Recognition not started")
      }
    }
  }, [isRecording, isSupported])

  return isSupported
}
