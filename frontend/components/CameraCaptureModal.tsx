"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  SwitchCamera,
  X,
  RotateCcw,
  Check,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Stop current active camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Enumerate camera devices
  const checkDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      setHasMultipleCameras(videoInputs.length > 1);
    } catch (e) {
      console.warn("Could not enumerate camera devices:", e);
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopStream();
    setIsLoading(true);
    setError(null);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError(
        "Direct camera access is not supported in this browser. You can use your device's native camera app instead."
      );
      setIsLoading(false);
      return;
    }

    try {
      // Build constraints with high resolution for sharp OCR & packaging text
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // If ideal facingMode fails (common on laptops where environment camera does not exist),
        // fallback to basic video request
        console.warn("Ideal video constraints failed, trying basic video:", firstErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await checkDevices();
      setIsLoading(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      let message = "Unable to access the camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        message =
          "Camera permission was denied. Please allow camera access in your browser site permissions to take photos directly.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        message = "No camera hardware detected on this device.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        message =
          "Camera is currently in use by another application. Please close other camera apps and try again.";
      } else if (err.name === "OverconstrainedError") {
        message = "Camera resolution requirements could not be satisfied by this hardware.";
      }
      setError(message);
      setIsLoading(false);
    }
  }, [facingMode, selectedDeviceId, stopStream, checkDevices]);

  // Trigger camera start / stop when modal opens / closes
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreview(null);
      startCamera();
    } else {
      stopStream();
      setCapturedBlob(null);
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
        setCapturedPreview(null);
      }
    }
    return () => {
      stopStream();
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch camera facing mode / device
  function handleToggleFacingMode() {
    if (videoDevices.length > 1) {
      // Find next device
      const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      setSelectedDeviceId(videoDevices[nextIndex].deviceId);
    } else {
      setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    }
  }

  // Effect to restart camera when facingMode or selectedDeviceId changes while open
  useEffect(() => {
    if (isOpen && !capturedBlob) {
      startCamera();
    }
  }, [facingMode, selectedDeviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture current frame from live video
  function handleSnap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedPreview(url);
        // Pause video while reviewing
        video.pause();
      },
      "image/jpeg",
      0.95
    );
  }

  // Retake photo
  function handleRetake() {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
      setCapturedPreview(null);
    }
    setCapturedBlob(null);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }

  // Confirm photo and pass file to parent
  function handleConfirm() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `packaging_label_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    stopStream();
    onCapture(file);
    onClose();
  }

  // Fallback file input change
  function handleFallbackCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      stopStream();
      onCapture(f);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/85 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[95vh] rounded-2xl bg-gov-navy border border-slate-700 shadow-2xl overflow-hidden">
        {/* 1. Header Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-700/80 bg-gov-navy-dark/95 px-4 py-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gov-saffron/20 border border-gov-saffron/30 flex items-center justify-center text-gov-saffron">
              <Camera size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Direct Packaging Scanner</div>
              <div className="text-[11px] text-slate-300">
                {capturedBlob
                  ? "Review Label Quality & Clarity"
                  : "Center commodity label inside target frame"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Camera Button (if multiple cameras or on mobile) */}
            {!capturedBlob && (hasMultipleCameras || facingMode) && (
              <button
                type="button"
                onClick={handleToggleFacingMode}
                disabled={isLoading}
                title="Switch between front and rear cameras"
                className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-600 transition-colors disabled:opacity-50"
              >
                <SwitchCamera size={15} className="text-gov-saffron" />
                <span className="hidden sm:inline">Flip Camera</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close camera scanner"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 2. Main Viewport / Camera Stream */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[420px] bg-black flex items-center justify-center overflow-hidden select-none">
          {/* Shutter flash animation */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-30 transition-opacity duration-200" />
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gov-navy/90 text-white gap-3 p-6 text-center">
              <div className="relative">
                <RefreshCw size={36} className="animate-spin text-gov-saffron" />
              </div>
              <p className="text-sm font-semibold">Initializing optical camera sensor...</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Requesting browser video stream for legal metrology inspection
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gov-navy/95 text-white gap-3.5 p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-rose-200">Camera Access Not Available</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{error}</p>
              </div>

              {/* Fallback buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => fileFallbackRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gov-saffron hover:bg-gov-saffron-dark text-gov-navy px-4 py-2 text-xs font-bold shadow-md transition-colors"
                >
                  <Camera size={15} />
                  <span>Use Device Camera App</span>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3.5 py-2 text-xs font-semibold transition-colors"
                >
                  <RotateCcw size={14} />
                  <span>Retry Connection</span>
                </button>
              </div>

              {/* Hidden file capture fallback */}
              <input
                ref={fileFallbackRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFallbackCapture}
              />
            </div>
          )}

          {/* Live Video Element */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-contain ${
              capturedBlob ? "hidden" : "block"
            }`}
          />

          {/* Captured Preview Image */}
          {capturedPreview && (
            <img
              src={capturedPreview}
              alt="Captured packaging snapshot"
              className="h-full w-full object-contain"
            />
          )}

          {/* Document Scanner Guide Overlay (Only active during live streaming) */}
          {!capturedBlob && !isLoading && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 sm:p-6">
              {/* Top Hint Badge */}
              <div className="rounded-full bg-slate-950/70 backdrop-blur-md border border-white/15 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-md flex items-center gap-1.5">
                <Sparkles size={12} className="text-gov-saffron" />
                <span>Keep text flat, well-lit, and in focus</span>
              </div>

              {/* Central Target Viewfinder Box */}
              <div className="relative w-11/12 max-w-md aspect-[4/3] rounded-xl border border-white/20 shadow-2xl flex items-center justify-center">
                {/* 4 Framing Corner Brackets */}
                <div className="absolute -top-1 -left-1 h-6 w-6 border-t-3 border-l-3 border-gov-saffron rounded-tl-md" />
                <div className="absolute -top-1 -right-1 h-6 w-6 border-t-3 border-r-3 border-gov-saffron rounded-tr-md" />
                <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-3 border-l-3 border-gov-saffron rounded-bl-md" />
                <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-3 border-r-3 border-gov-saffron rounded-br-md" />

                {/* Sweeping Laser Scanner */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan-laser opacity-80" />

                {/* Subtle Center Reticle */}
                <div className="h-4 w-4 border-t border-b border-white/40" />
                <div className="h-4 w-4 border-l border-r border-white/40 absolute" />
              </div>

              {/* Bottom Instructions */}
              <div className="text-[10.5px] text-slate-300 bg-slate-950/70 px-3 py-1 rounded-full backdrop-blur-xs">
                Capturing at native camera sensor resolution for OCR accuracy
              </div>
            </div>
          )}

          {/* Hidden Canvas used for high-res extraction */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* 3. Bottom Action Controls Bar */}
        <div className="border-t border-slate-700/80 bg-gov-navy-dark/95 p-4 text-center">
          {capturedBlob ? (
            /* Review Actions */
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors"
              >
                <RotateCcw size={15} />
                <span>Retake Photo</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-100"
              >
                <Check size={16} />
                <span>Use This Photo for Inspection</span>
              </button>
            </div>
          ) : (
            /* Live Camera Shutter Control */
            <div className="flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={handleSnap}
                disabled={isLoading || Boolean(error)}
                className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-white p-1 shadow-xl shadow-black/50 transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                aria-label="Capture photograph"
              >
                {/* Outer Ring */}
                <div className="h-full w-full rounded-full border-2 border-slate-800 bg-gov-saffron flex items-center justify-center group-hover:bg-gov-saffron-dark transition-colors">
                  <Camera size={26} className="text-gov-navy" />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
