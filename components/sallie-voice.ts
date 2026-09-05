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

/** One frame of Sallie's voice: overall level (0..1) and a coarse spectrum (0..255 per bin). */
export interface AudioFrame {
  level: number;
  bins: Uint8Array;
}
type AudioListener = (frame: AudioFrame) => void;
const audioListeners = new Set<AudioListener>();
const SILENT_BINS = new Uint8Array(64);
const SILENCE: AudioFrame = { level: 0, bins: SILENT_BINS };

/** Subscribe to Sallie's voice frames (mouth level + spectrum). Returns an unsubscribe. */
export function subscribeAudio(listener: AudioListener) {
  audioListeners.add(listener);
  return () => {
    audioListeners.delete(listener);
  };
}

/** Subscribe to just the mouth level (0..1). Returns an unsubscribe. */
export function subscribeMouth(listener: (level: number) => void) {
  return subscribeAudio((f) => listener(f.level));
}

function publishAudio(frame: AudioFrame) {
  audioListeners.forEach((l) => l(frame));
}

function publishMouth(level: number) {
  publishAudio(level === 0 ? SILENCE : { level, bins: SILENT_BINS });
}

/** Fake spectrum for the browser-synth fallback so the ring still moves. */
function syntheticBins(level: number, t: number): Uint8Array {
  const bins = new Uint8Array(64);
  for (let i = 0; i < bins.length; i++) {
    const shape = Math.max(0, 1 - i / bins.length);
    const wobble = 0.6 + 0.4 * Math.sin(t * 0.9 + i * 0.5);
    bins[i] = Math.round(255 * level * shape * wobble);
  }
  return bins;
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
  // Each speak() gets a sequence number so a slow earlier request can't play late.
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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
    seqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
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
        const level = 0.35 + 0.45 * Math.abs(Math.sin(t * 0.35) * Math.cos(t * 0.11));
        publishAudio({ level, bins: syntheticBins(level, t) });
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

  /** Plays decoded audio; 'blocked' means autoplay held it back, 'failed' means the body wasn't playable. */
  const playBuffer = useCallback(
    async (audio: ArrayBuffer): Promise<'played' | 'blocked' | 'failed'> => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return 'failed';
      const ctx = ctxRef.current ?? new AudioCtx();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // handled below
        }
      }
      if (ctx.state !== 'running') return 'blocked';

      if (audio.byteLength === 0) return 'failed';
      let buffer: AudioBuffer;
      try {
        buffer = await ctx.decodeAudioData(audio.slice(0));
      } catch {
        return 'failed';
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.fftSize);
      const freq = new Uint8Array(analyser.frequencyBinCount);
      let smoothed = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        analyser.getByteFrequencyData(freq);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Speech RMS sits around 0.02–0.12; lift it into a useful 0..1 range.
        const target = Math.min(1, Math.sqrt(rms * 6));
        smoothed = smoothed + (target - smoothed) * (target > smoothed ? 0.5 : 0.25);
        // Speech lives in the low bins; keep the first quarter for the ring.
        publishAudio({ level: smoothed, bins: freq.subarray(0, 64) });
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
      return 'played';
    },
    [stopLevelLoop]
  );

  const speak = useCallback(
    async (text: string) => {
      if (mutedRef.current || !text.trim()) return;
      stop();
      const seq = seqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      let audio: ArrayBuffer | null = null;
      try {
        const res = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (res.ok) audio = await res.arrayBuffer();
      } catch {
        audio = null;
      }
      // Superseded by a newer speak()/stop() while we were fetching.
      if (seq !== seqRef.current || mutedRef.current) return;
      if (audio) {
        const result = await playBuffer(audio);
        if (result === 'played') {
          setBlocked(false);
          return;
        }
        if (result === 'blocked') {
          // Autoplay was blocked: keep the text and say it after the next interaction.
          pendingRef.current = text;
          setBlocked(true);
          return;
        }
        // Unplayable body: fall through to the browser's own voice.
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

  useEffect(
    () => () => {
      stop();
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    },
    [stop]
  );

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

const MAX_CLIP_MS = 30000;

function friendlyMicError(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow the mic for this site and try again.';
    case 'no-speech':
      return "I didn't catch anything — try again a little closer to the mic.";
    case 'audio-capture':
      return 'No microphone was found.';
    default:
      return "I couldn't hear you just then. Please try again.";
  }
}

interface SpeechInputOptions {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  /** A capture ended without any speech. */
  onSilent?: () => void;
}

/**
 * Listening has two paths. The browser's own SpeechRecognition streams live
 * text into the box while you talk. Where it's missing (Firefox, Safari) or
 * fails (Chromium builds without Google's speech keys report "network"), the
 * mic is recorded with MediaRecorder and transcribed by /api/listen instead.
 */
export function useSpeechInput({ onInterim, onFinal, onSilent }: SpeechInputOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once the browser recogniser fails we stop trying it for this visit.
  const useRecorder = useRef(false);
  const callbacks = useRef({ onInterim, onFinal, onSilent });
  useEffect(() => {
    callbacks.current = { onInterim, onFinal, onSilent };
  }, [onInterim, onFinal, onSilent]);

  useEffect(() => {
    const hasRecognition = getRecognition() !== null;
    const hasRecorder =
      typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    useRecorder.current = !hasRecognition;
    setSupported(hasRecognition || hasRecorder);
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'clip.webm');
      const res = await fetch('/api/listen', { method: 'POST', body: form });
      if (res.status === 429 || res.status === 503) {
        setError("I've had to pause listening for a little while — please type instead.");
        return;
      }
      if (!res.ok) throw new Error(`Listen API responded with ${res.status}`);
      const data = await res.json();
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (text) callbacks.current.onFinal(text);
      else callbacks.current.onSilent?.();
    } catch (err) {
      console.warn('Transcription failed', err);
      setError("I couldn't process that recording. Please try again or type instead.");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const startRecorder = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser has no way to listen. Please type instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) =>
        MediaRecorder.isTypeSupported(m)
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        releaseStream();
        recorderRef.current = null;
        setListening(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) void transcribe(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
      callbacks.current.onInterim?.('');
      timerRef.current = setTimeout(
        () => recorder.state === 'recording' && recorder.stop(),
        MAX_CLIP_MS
      );
    } catch (err) {
      console.warn('Microphone unavailable', err);
      releaseStream();
      setListening(false);
      setError(friendlyMicError('not-allowed'));
    }
  }, [releaseStream, transcribe]);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return false;
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = 'en-GB';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalText = '';
    let failedOver = false;
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
      // A previous, aborted instance can still fire; only the live one may touch state.
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (failedOver) return;
      setListening(false);
      const text = finalText.trim();
      if (text) callbacks.current.onFinal(text);
      else callbacks.current.onSilent?.();
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      const code = event.error;
      console.warn('Speech recognition error', code);
      recognitionRef.current = null;
      if (
        code === 'network' ||
        code === 'service-not-allowed' ||
        code === 'language-not-supported'
      ) {
        // The browser can't do it; record and transcribe server-side from now on.
        failedOver = true;
        useRecorder.current = true;
        void startRecorder();
        return;
      }
      setListening(false);
      if (code === 'no-speech') callbacks.current.onSilent?.();
      else if (code !== 'aborted') setError(friendlyMicError(code));
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      return true;
    } catch (err) {
      // Permissions, insecure context or a transient browser state.
      console.warn('Speech recognition could not start', err);
      recognitionRef.current = null;
      return false;
    }
  }, [startRecorder]);

  const startListening = useCallback(() => {
    setError(null);
    if (!useRecorder.current && startRecognition()) return;
    void startRecorder();
  }, [startRecognition, startRecorder]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      releaseStream();
    },
    [releaseStream]
  );

  return { supported, listening, transcribing, error, startListening, stopListening };
}
