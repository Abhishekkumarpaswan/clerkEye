"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice (SPEC.md §13): browser `speechSynthesis`, `hi-IN` or `en-IN`.
 *
 * If the device has no matching voice we say so — never silently fail and never
 * pretend the audio worked.
 */

export type SpeechState = {
  speakingKey: string | null;
  voiceAvailable: boolean;
  speak: (key: string, text: string) => void;
  stop: () => void;
  unavailableNotice: string | null;
};

export function useSpeech(langTag: string, unavailableMessage: string): SpeechState {
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const base = langTag.split("-")[0];
      const match = voices.some(
        (voice) =>
          voice.lang === langTag || voice.lang.replace("_", "-").toLowerCase().startsWith(base),
      );
      setVoiceAvailable(match);
    };

    // Voice lists load asynchronously in most browsers; the timer keeps the
    // first check out of the effect body, and the event covers later arrivals.
    const timer = window.setTimeout(checkVoices, 0);
    window.speechSynthesis.addEventListener("voiceschanged", checkVoices);

    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", checkVoices);
      window.speechSynthesis.cancel();
    };
  }, [langTag]);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, []);

  const speak = useCallback(
    (key: string, text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setUnavailableNotice(unavailableMessage);
        return;
      }

      const voices = window.speechSynthesis.getVoices();
      const base = langTag.split("-")[0];
      const voice =
        voices.find((candidate) => candidate.lang === langTag) ??
        voices.find((candidate) =>
          candidate.lang.replace("_", "-").toLowerCase().startsWith(base),
        );

      if (!voice) {
        setUnavailableNotice(unavailableMessage);
        return;
      }

      setUnavailableNotice(null);
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langTag;
      utterance.voice = voice;
      // Hindi is spoken a little slower, which helps on cheap phone speakers.
      utterance.rate = langTag.startsWith("hi") ? 0.92 : 1;
      utterance.onend = () => setSpeakingKey(null);
      utterance.onerror = () => {
        setSpeakingKey(null);
        setUnavailableNotice(unavailableMessage);
      };

      utteranceRef.current = utterance;
      setSpeakingKey(key);
      window.speechSynthesis.speak(utterance);
    },
    [langTag, unavailableMessage],
  );

  return { speakingKey, voiceAvailable, speak, stop, unavailableNotice };
}
