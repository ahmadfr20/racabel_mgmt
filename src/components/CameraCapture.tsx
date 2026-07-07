"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Loader2 } from "lucide-react";

// Ambil foto dari webcam, kembalikan data URL (base64 JPEG).
export function CameraCapture({
  onConfirm,
  confirmLabel,
  loading,
}: {
  onConfirm: (dataUrl: string) => void;
  confirmLabel: string;
  loading?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function start() {
    setError("");
    setShot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch {
      setError("Tidak dapat mengakses kamera. Izinkan akses kamera pada browser Anda.");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d")!;
    // Mirror agar sesuai tampilan
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.7));
  }

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-900">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Hasil foto" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted />
        )}
        {!ready && !shot && !error && (
          <div className="absolute inset-0 grid place-items-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-300">{error}</div>}
      </div>

      <div className="mt-4 flex gap-2">
        {shot ? (
          <>
            <button className="btn-ghost flex-1" onClick={() => setShot(null)} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Ambil Ulang
            </button>
            <button className="btn-primary flex-1" onClick={() => onConfirm(shot)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {confirmLabel}
            </button>
          </>
        ) : (
          <button className="btn-primary w-full" onClick={capture} disabled={!ready}>
            <Camera className="h-4 w-4" /> Ambil Foto
          </button>
        )}
      </div>
    </div>
  );
}
