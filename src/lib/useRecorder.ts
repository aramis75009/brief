"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_SECONDS = 120;

/**
 * Ordre imposé : Safari iOS ne produit que du mp4. On demande donc mp4 en
 * premier, puis opus, puis webm nu. Le mimeType réellement retenu part avec le
 * blob — le serveur ne doit jamais le deviner.
 */
const MIME_CANDIDATES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export type RecorderStatus = "idle" | "requesting" | "recording" | "error";

export type RecorderError = {
  title: string;
  /** Marche à suivre concrète — jamais un bouton mort. */
  steps: string[];
};

export type Recording = {
  blob: Blob;
  mimeType: string;
  seconds: number;
};

const BARS = 4;

export function useRecorder(onComplete: (rec: Recording) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(0.35));

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le callback est lu depuis `onstop`, hors cycle de rendu : on le garde à jour
  // dans un effet plutôt que pendant le rendu.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /**
   * Libère TOUT : pistes du MediaStream (sinon l'indicateur micro iOS reste
   * allumé après l'arrêt), AudioContext, rAF et timer d'arrêt automatique.
   */
  const releaseHardware = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      void ctx.close().catch(() => {});
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => releaseHardware, [releaseHardware]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop(); // onstop assemble le blob puis appelle releaseHardware
    } else {
      releaseHardware();
      setStatus("idle");
    }
  }, [releaseHardware]);

  const start = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      setStatus("error");
      setError({
        title: "Le micro exige une connexion sécurisée.",
        steps: ["Ouvre cette page en HTTPS (l'URL doit commencer par https://)."],
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setError({
        title: "Ce navigateur ne sait pas enregistrer d'audio.",
        steps: [
          "Sur iPhone, ouvre Brief dans Safari.",
          "Vérifie que iOS est à jour (iOS 14.3 minimum).",
        ],
      });
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      setStatus("error");
      setError({
        title: "Aucun format audio compatible sur cet appareil.",
        steps: ["Essaie depuis Safari (iPhone) ou Chrome (ordinateur)."],
      });
      return;
    }

    setStatus("requesting");

    let stream: MediaStream;
    try {
      // Demandé au tap uniquement — jamais au chargement de la page.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setStatus("error");
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError({
          title: "Accès au micro refusé.",
          steps: [
            "iPhone : Réglages → Safari → Micro → Autoriser, puis recharge la page.",
            "Ou touche « aA » dans la barre d'adresse → Réglages du site web → Micro → Autoriser.",
            "Ordinateur : clique sur l'icône de cadenas à gauche de l'URL et autorise le micro.",
          ],
        });
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError({
          title: "Aucun micro détecté.",
          steps: ["Branche un micro ou utilise un appareil qui en possède un."],
        });
      } else {
        setError({
          title: "Le micro n'a pas pu démarrer.",
          steps: [
            "Ferme les autres apps ou onglets qui utilisent le micro, puis réessaie.",
          ],
        });
      }
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // --- Analyse du niveau réel pour piloter l'onde -------------------------
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      ctxRef.current = ctx;
      // Safari peut créer le contexte suspendu même après un geste utilisateur.
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      const bins = new Uint8Array(analyser.frequencyBinCount);
      const bandSize = Math.floor(bins.length / BARS);

      const tick = () => {
        analyser.getByteFrequencyData(bins);
        const next: number[] = [];
        for (let b = 0; b < BARS; b++) {
          let sum = 0;
          for (let i = b * bandSize; i < (b + 1) * bandSize; i++) sum += bins[i];
          const avg = sum / bandSize / 255;
          // Plancher à 0.35 : la barre reste visible dans le silence, comme la maquette.
          next.push(Math.min(1, Math.max(0.35, avg * 2.4)));
        }
        setLevels(next);
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* Pas d'analyse possible : l'enregistrement continue, l'onde reste au repos. */
    }

    // --- Enregistrement ------------------------------------------------------
    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      releaseHardware();
      setStatus("idle");
      setSeconds(0);
      setLevels(new Array(BARS).fill(0.35));
      if (blob.size > 0) onCompleteRef.current({ blob, mimeType, seconds: elapsed });
    };
    rec.onerror = () => {
      releaseHardware();
      setStatus("error");
      setError({
        title: "L'enregistrement s'est interrompu.",
        steps: ["Réessaie. Si ça recommence, recharge la page."],
      });
    };

    startedAtRef.current = Date.now();
    rec.start();
    setSeconds(0);
    setStatus("recording");

    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    }, MAX_SECONDS * 1000);
  }, [releaseHardware]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  return {
    status,
    recording: status === "recording",
    busy: status === "requesting",
    error,
    seconds,
    levels,
    start,
    stop,
    dismissError,
  };
}
