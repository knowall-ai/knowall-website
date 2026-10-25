import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechInput } from '@/components/sallie-voice';

/**
 * useSpeechInput (recorder path) tests
 *
 * Requirements: sallie-chat
 * - Turning the mic off while the browser is still asking for permission
 *   must not start recording once permission arrives
 * - Two starts while the prompt is open open the mic only once
 */
describe('useSpeechInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubRecorder() {
    let grant: (stream: MediaStream) => void = () => {};
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        })
    );
    const started = vi.fn();
    class FakeMediaRecorder {
      static isTypeSupported = () => true;
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: unknown = null;
      onstop: unknown = null;
      start() {
        this.state = 'recording';
        started();
      }
      stop() {
        this.state = 'inactive';
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    return { getUserMedia, started, stopTrack, grant: () => grant(stream) };
  }

  it('does not record if the mic is turned off while permission is pending', async () => {
    const rec = stubRecorder();
    const { result } = renderHook(() => useSpeechInput({ onFinal: vi.fn() }));
    act(() => result.current.startListening());
    // A second start (e.g. the hands-free loop) while the prompt is open is ignored
    act(() => result.current.startListening());
    expect(rec.getUserMedia).toHaveBeenCalledTimes(1);

    act(() => result.current.stopListening());
    await act(async () => rec.grant());

    expect(rec.started).not.toHaveBeenCalled();
    expect(rec.stopTrack).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('records once permission is granted when still wanted', async () => {
    const rec = stubRecorder();
    const { result } = renderHook(() => useSpeechInput({ onFinal: vi.fn() }));
    act(() => result.current.startListening());
    await act(async () => rec.grant());
    expect(rec.started).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(true);
  });
});
