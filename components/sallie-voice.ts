'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sallie's voice: speaking her replies aloud and listening to the visitor.
 *
 * Speech comes from /api/speak (OpenAI text-to-speech) and is played through
 * the Web Audio API so an AnalyserNode can measure her live level; that level
 * drives the rig's mouth. If the API is unavailable the browser's own
 * speechSynthesis is used with a synthetic mouth level. Listening uses the
 * browser's SpeechRecognition — nothing leaves the visitor's device except
 * the final transcript, which goes to /api/chat exactly like a typed message.
 */

type MouthListener = (level: number) => void;
const mouthListeners = new Set<MouthListener>();

/** Subscribe to Sallie's mouth level (0..1). Returns an unsubscribe. */
export function subscribeMouth(listener: MouthListener) {
  mouthListeners.add(listener);
  return () => {
    mouthListeners.delete(listener);
  };
}

function publishMouth(level: number) {
  mouthListeners.forEach((l) => l(level));
}

const MUTED_KEY = 'sallie-muted';

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function useSallieVoice() {
  const [muted, setMutedState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // True when the browser refused to play before a user interaction.
  const [blocked, setBlocked] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const pendingRef = useRef<string | null>(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    const m = readMuted();
    mutedRef.current = m;
    setMutedState(m);
  }, []);

  const stopLevelLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    publishMouth(0);
  }, []);

  const stop = useCallback(() => {
    pendingRef.current = null;
    try {
      sourceRef.current?.stop();
    } catch {
      // already stopped
    }
    sourceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopLevelLoop();
    setSpeaking(false);
  }, [stopLevelLoop]);

  /** Fallback voice: the browser's own synthesiser with a synthetic mouth. */
  const speakWithSynth = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /en-GB/i.test(v.lang) && /female|woman|sonia|libby/i.test(v.name)) ||
        voices.find((v) => /en-GB/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang));
      if (preferred) utterance.voice = preferred;
      let t = 0;
      const tick = () => {
        t += 1;
        // A gentle pseudo-random mouth so she visibly talks even without audio analysis.
        publishMouth(0.35 + 0.45 * Math.abs(Math.sin(t * 0.35) * Math.cos(t * 0.11)));
        rafRef.current = requestAnimationFrame(tick);
      };
      utterance.onstart = () => {
        setSpeaking(true);
        tick();
      };
      utterance.onend = utterance.onerror = () => {
        stopLevelLoop();
        setSpeaking(false);
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [stopLevelLoop]
  );

  const playBuffer = useCallback(
    async (audio: ArrayBuffer) => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      const ctx = ctxRef.current ?? new AudioCtx();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // handled below
        }
      }
      if (ctx.state !== 'running') return false;

      const buffer = await ctx.decodeAudioData(audio.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.fftSize);
      let smoothed = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Speech RMS sits around 0.02–0.12; lift it into a useful 0..1 range.
        const target = Math.min(1, Math.sqrt(rms * 6));
        smoothed = smoothed + (target - smoothed) * (target > smoothed ? 0.5 : 0.25);
        publishMouth(smoothed);
        rafRef.current = requestAnimationFrame(tick);
      };
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null;
          stopLevelLoop();
          setSpeaking(false);
        }
      };
      sourceRef.current = source;
      setSpeaking(true);
      source.start();
      tick();
      return true;
    },
    [stopLevelLoop]
  );

  const speak = useCallback(
    async (text: string) => {
      if (mutedRef.current || !text.trim()) return;
      stop();
      let audio: ArrayBuffer | null = null;
      try {
        const res = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) audio = await res.arrayBuffer();
      } catch {
        audio = null;
      }
      if (mutedRef.current) return;
      if (audio) {
        const played = await playBuffer(audio);
        if (played) {
          setBlocked(false);
          return;
        }
        // Autoplay was blocked: keep the text and say it after the next interaction.
        pendingRef.current = text;
        setBlocked(true);
        return;
      }
      if (!speakWithSynth(text)) {
        pendingRef.current = null;
      }
    },
    [playBuffer, speakWithSynth, stop]
  );

  /** Call from a user gesture to release anything autoplay held back. */
  const unlock = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || mutedRef.current) return;
    pendingRef.current = null;
    void speak(pending);
  }, [speak]);

  const setMuted = useCallback(
    (value: boolean) => {
      mutedRef.current = value;
      setMutedState(value);
      try {
        window.localStorage.setItem(MUTED_KEY, value ? '1' : '0');
      } catch {
        // storage unavailable — muting still works for this visit
      }
      if (value) stop();
      else setBlocked(false);
    },
    [stop]
  );

  useEffect(() => () => stop(), [stop]);

  return { muted, setMuted, speaking, blocked, speak, stop, unlock };
}

// --- Listening -------------------------------------------------------------

type RecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function getRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface SpeechInputOptions {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
}

export function useSpeechInput({ onInterim, onFinal }: SpeechInputOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbacks = useRef({ onInterim, onFinal });
  useEffect(() => {
    callbacks.current = { onInterim, onFinal };
  }, [onInterim, onFinal]);

  useEffect(() => {
    setSupported(getRecognition() !== null);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = 'en-GB';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      callbacks.current.onInterim?.((finalText + interim).trim());
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalText.trim();
      if (text) callbacks.current.onFinal(text);
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, startListening, stopListening };
}
