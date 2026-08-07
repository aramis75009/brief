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

/* ---------------------------------------------------------------------------
 * Stream partagé — UNE seule autorisation par session.
 *
 * Le flux et l'AudioContext vivent au niveau du module, pas du composant : on
 * appelle getUserMedia au premier tap sur le micro, puis on réutilise. Les
 * enregistrements suivants ne redemandent rien.
 *
 * ⚠️ Conséquence assumée : tant que le flux est ouvert, l'indicateur micro d'iOS
 * (pastille orange) reste allumé entre deux dictées. C'est le prix de la
 * réutilisation. On relâche donc explicitement quand la page passe en arrière-
 * plan ou se ferme (pagehide), ce qui éteint l'indicateur en sortant de l'app.
 * ------------------------------------------------------------------------ */
let sharedStream: MediaStream | null = null;
let sharedCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;

function streamIsLive(s: MediaStream | null): s is MediaStream {
  return !!s && s.getAudioTracks().some((t) => t.readyState === "live");
}

async function acquireStream(): Promise<MediaStream> {
  if (streamIsLive(sharedStream)) return sharedStream;
  sharedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Le graphe d'analyse est reconstruit avec le nouveau flux.
  sharedAnalyser = null;
  return sharedStream;
}

function releaseShared() {
  if (sharedStream) {
    for (const track of sharedStream.getTracks()) track.stop();
    sharedStream = null;
  }
  sharedAnalyser = null;
  if (sharedCtx) {
    const ctx = sharedCtx;
    sharedCtx = null;
    void ctx.close().catch(() => {});
  }
}

if (typeof window !== "undefined") {
  // Sortie de l'app / fermeture d'onglet : on rend le micro au système.
  window.addEventListener("pagehide", releaseShared);
}

async function getAnalyser(stream: MediaStream): Promise<AnalyserNode | null> {
  if (sharedAnalyser) return sharedAnalyser;
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!sharedCtx) sharedCtx = new Ctor();
    // Safari peut rendre le contexte suspendu même après un geste utilisateur.
    if (sharedCtx.state === "suspended") await sharedCtx.resume();

    const source = sharedCtx.createMediaStreamSource(stream);
    const analyser = sharedCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    sharedAnalyser = analyser;
    return analyser;
  } catch {
    return null;
  }
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
const FLOOR = 0.35;

export function useRecorder(onComplete: (rec: Recording) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => new Array(BARS).fill(FLOOR));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /** Arrête la mesure et les timers — sans toucher au flux, qui est réutilisé. */
  const stopMetering = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopMetering();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* déjà arrêté */
        }
      }
      releaseShared();
    },
    [stopMetering],
  );

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop(); // onstop assemble le blob
    } else {
      stopMetering();
      setStatus("idle");
    }
  }, [stopMetering]);

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

    // `requesting` n'est visible qu'à la toute première dictée de la session :
    // ensuite acquireStream rend le flux déjà autorisé, sans prompt.
    const firstTime = !streamIsLive(sharedStream);
    if (firstTime) setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await acquireStream();
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
          steps: ["Ferme les autres apps ou onglets qui utilisent le micro, puis réessaie."],
        });
      }
      return;
    }

    chunksRef.current = [];

    // --- Niveau réel pour piloter l'onde ------------------------------------
    const analyser = await getAnalyser(stream);
    if (analyser) {
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const bandSize = Math.floor(bins.length / BARS);
      const tick = () => {
        analyser.getByteFrequencyData(bins);
        const next: number[] = [];
        for (let b = 0; b < BARS; b++) {
          let sum = 0;
          for (let i = b * bandSize; i < (b + 1) * bandSize; i++) sum += bins[i];
          const avg = sum / bandSize / 255;
          // Plancher : la barre reste visible dans le silence, comme la maquette.
          next.push(Math.min(1, Math.max(FLOOR, avg * 2.4)));
        }
        setLevels(next);
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
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
      stopMetering();
      recorderRef.current = null;
      setStatus("idle");
      setSeconds(0);
      setLevels(new Array(BARS).fill(FLOOR));
      if (blob.size > 0) onCompleteRef.current({ blob, mimeType, seconds: elapsed });
    };
    rec.onerror = () => {
      stopMetering();
      recorderRef.current = null;
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
  }, [stopMetering]);

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
