"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// Define the window augmentation for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

interface SpeechRecognitionProps {
  isRecording: boolean
  onResult: (transcript: string) => void
  onEnd: () => void
}

// Create a class-based wrapper for the Web Speech API
class SpeechRecognitionService {
  recognition: any = null;
  isSupported: boolean = false;
  
  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.isSupported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      }
    }
  }
  
  start(onResult: (transcript: string) => void, onEnd: () => void) {
    if (!this.recognition) return false;
    
    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result) => result.transcript)
        .join("");
      
      onResult(transcript);
    };
    
    this.recognition.onend = onEnd;
    
    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.log("Recognition failed to start", error);
      return false;
    }
  }
  
  stop() {
    if (!this.recognition) return;
    
    try {
      this.recognition.stop();
    } catch (error) {
      console.log("Recognition failed to stop", error);
    }
  }
}

// Create a singleton instance
let speechRecognitionService: SpeechRecognitionService | null = null;

// This function ensures we only create one instance
function getSpeechRecognitionService() {
  if (!speechRecognitionService && typeof window !== 'undefined') {
    speechRecognitionService = new SpeechRecognitionService();
  }
  return speechRecognitionService;
}

export default function useSpeechRecognition({ isRecording, onResult, onEnd }: SpeechRecognitionProps) {
  const [isSupported, setIsSupported] = useState(false);
  const serviceRef = useRef<SpeechRecognitionService | null>(null);
  
  // Memoize callbacks to avoid unnecessary re-renders
  const handleResult = useCallback(onResult, [onResult]);
  const handleEnd = useCallback(onEnd, [onEnd]);
  
  // Initialize the service once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const service = getSpeechRecognitionService();
    serviceRef.current = service;
    setIsSupported(!!service?.isSupported);
    
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stop();
      }
    };
  }, []);
  
  // Handle recording state changes
  useEffect(() => {
    const service = serviceRef.current;
    if (!service || !isSupported) return;
    
    if (isRecording) {
      service.start(handleResult, handleEnd);
    } else {
      service.stop();
    }
  }, [isRecording, isSupported, handleResult, handleEnd]);
  
  return isSupported;
}
