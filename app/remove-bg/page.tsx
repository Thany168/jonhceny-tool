"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { FaRobot } from "react-icons/fa";
import { PiLockKeyFill } from "react-icons/pi";
import { FaBoltLightning } from "react-icons/fa6";
import { IoArrowBackCircleOutline } from "react-icons/io5";

import "./page.css";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

interface ImageInfo {
  file: File;
  url: string;
  width: number;
  height: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImageInfo(file: File): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        file,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = reject;
    img.src = url;
  });
}

async function refineEdges(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Draw the AI result
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data; // RGBA flat array

  // ── Pass 1: Remove fringe (semi-transparent pixels near edges) ──
  // Any pixel with alpha < 30 gets fully transparent (removes dark halo)
  // Any pixel with alpha > 220 stays fully opaque
  // In between: smooth the transition
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 30) {
      // Fully transparent — also zero out RGB to avoid dark fringe
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else if (a < 220) {
      // Semi-transparent edge pixel — apply feathering curve
      // Sigmoid-like ramp: pushes mid-values toward 0 or 255
      const normalized = a / 255;
      const sharpened =
        normalized < 0.5
          ? 2 * normalized * normalized
          : 1 - Math.pow(-2 * normalized + 2, 2) / 2;
      data[i + 3] = Math.round(sharpened * 255);
    }
  }

  // ── Pass 2: Erode 1px on the alpha channel ──
  // Removes the 1-pixel ring of residual colour at hard edges
  const eroded = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 10) {
        // Check immediate neighbours — if any neighbour is transparent, shrink
        const top = data[((y - 1) * width + x) * 4 + 3];
        const bottom = data[((y + 1) * width + x) * 4 + 3];
        const left = data[(y * width + (x - 1)) * 4 + 3];
        const right = data[(y * width + (x + 1)) * 4 + 3];
        const minNeighbour = Math.min(top, bottom, left, right);
        if (minNeighbour < 128) {
          // Shrink this edge pixel proportionally
          eroded[idx + 3] = Math.round(alpha * (minNeighbour / 255));
          eroded[idx] = 0;
          eroded[idx + 1] = 0;
          eroded[idx + 2] = 0;
        }
      }
    }
  }

  // Write refined pixels back
  const refined = new ImageData(eroded, width, height);
  ctx.putImageData(refined, 0, 0);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
}

export default function RemoveBgPage() {
  const [image, setImage] = useState<ImageInfo | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [progress, setProgress] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [bgColor, setBgColor] = useState<string>("transparent");

  const inputRef = useRef<HTMLInputElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load file ──
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/image\/(png|jpe?g|webp)/)) {
      alert("Only PNG, JPG, JPEG, WebP are supported.");
      return;
    }
    const info = await loadImageInfo(file);
    setImage(info);
    setResultUrl("");
    setStatus("idle");
    setProgress("");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Remove background ──
  async function removeBackground() {
    if (!image) return;
    setStatus("processing");
    setProgress("Loading AI model… (first run may take ~10s)");

    try {
      // Dynamically import to avoid SSR issues
      const { removeBackground } = await import("@imgly/background-removal");

      setProgress("Analysing image…");

      // Use "isnet" (large) — highest quality model, best edge detection
      const blob = await removeBackground(image.file, {
        model: "isnet", // large = best quality (vs medium=isnet_fp16, small=isnet_quint8)
        output: {
          format: "image/png",
          quality: 1.0,
        },
        progress: (key: string, current: number, total: number) => {
          if (key === "compute:inference") {
            const pct = Math.round((current / total) * 100);
            setProgress(`AI processing… ${pct}%`);
          } else if (key.startsWith("fetch")) {
            setProgress("Downloading AI model (one-time ~80MB)");
          } else if (key === "compute:preprocess") {
            setProgress("Preparing image…");
          } else if (key === "compute:postprocess") {
            setProgress("Refining edges…");
          }
        },
        publicPath: `https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/`,
      });

      setProgress("Cleaning up edges…");

      // ── Post-processing: refine edges on canvas ──
      const refinedBlob = await refineEdges(blob);

      const url = URL.createObjectURL(refinedBlob);
      setResultUrl(url);
      setStatus("done");
      setProgress("");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setProgress("Something went wrong. Please try again.");
    }
  }

  // ── Apply background color and download ──
  async function download() {
    if (!resultUrl) return;

    const img = new Image();
    img.src = resultUrl;
    await new Promise((r) => (img.onload = r));

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;

    if (bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);

    const ext = bgColor === "transparent" ? "png" : "jpg";
    const quality = bgColor === "transparent" ? undefined : 0.95;
    const mime = bgColor === "transparent" ? "image/png" : "image/jpeg";

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `removed_bg_${image?.file.name.replace(/\.[^.]+$/, "")}.${ext}`;
        a.click();
      },
      mime,
      quality,
    );
  }

  function clearImage() {
    setImage(null);
    setResultUrl("");
    setStatus("idle");
    setProgress("");
    setShowOriginal(false);
  }

  const BG_PRESETS = [
    { label: "Transparent", value: "transparent" },
    { label: "White", value: "#ffffff" },
    { label: "Black", value: "#000000" },
    { label: "Red", value: "#ef4444" },
    { label: "Blue", value: "#3b82f6" },
    { label: "Green", value: "#22c55e" },
    { label: "Yellow", value: "#eab308" },
  ];

  return (
    <div className="page-wrap">
      <div className="tool-screen">
        {/* ── Header ── */}
        <div className="cert-header">
          <Link href="/" className="cert-logo">
            KHMER DIGITAL TOOLS
          </Link>
          <Link href="/" className="back-link">
            <IoArrowBackCircleOutline /> Back to Options
          </Link>
        </div>

        <h1 className="tool-title">✂ Remove Background</h1>
        <p className="tool-subtitle">
          AI-powered · 100% in your browser · No upload to server
        </p>

        {/* ── Badges ── */}
        <div className="platform-row">
          <div className="platform-pill active-pill">
            {" "}
            <FaRobot />
            AI Powered
          </div>
          <div className="platform-pill active-pill">
            <PiLockKeyFill />
            Private
          </div>
          <div className="platform-pill active-pill">
            <FaBoltLightning />
            Free
          </div>
        </div>

        <div className="tool-card">
          {/* ── Drop Zone ── */}
          {!image ? (
            <div
              className={`drop-zone ${isDragging ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
              <div className="drop-hint">
                <span className="drop-icon"></span>
                <p className="drop-title">Drop image here or click to upload</p>
                <p className="drop-sub">PNG · JPG · JPEG · WebP</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Preview area ── */}
              <div className="preview-area">
                {/* Original */}
                <div className="preview-col">
                  <p className="preview-col-label">Original</p>
                  <div className="preview-img-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt="original"
                      className="preview-img"
                    />
                  </div>
                  <p className="preview-meta">
                    {image.width} × {image.height} px ·{" "}
                    {formatSize(image.file.size)}
                  </p>
                </div>

                {/* Result */}
                <div className="preview-col">
                  <p className="preview-col-label">Result</p>
                  <div
                    className="preview-img-wrap checkered"
                    style={
                      bgColor !== "transparent" ? { background: bgColor } : {}
                    }
                  >
                    {resultUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resultUrl}
                        alt="result"
                        className="preview-img"
                      />
                    ) : (
                      <div className="preview-placeholder">
                        {status === "processing" ? (
                          <div className="ai-processing">
                            <div className="ai-spinner" />
                            <p>{progress}</p>
                          </div>
                        ) : (
                          <p className="placeholder-text">
                            Result appears here
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {resultUrl && (
                    <p className="preview-meta result-ready-text">
                      Background removed
                    </p>
                  )}
                </div>
              </div>

              {/* ── Meta bar ── */}
              <div className="meta-bar">
                <span className="meta-pill">
                  {image.file.name.length > 24
                    ? image.file.name.slice(0, 22) + "…"
                    : image.file.name}
                </span>
                <span className="meta-pill">{formatSize(image.file.size)}</span>
                <span className="meta-pill">
                  {image.width} × {image.height} px
                </span>
              </div>

              {/* ── Progress bar ── */}
              {status === "processing" && (
                <div className="progress-wrap">
                  <div className="progress-track">
                    <div className="progress-fill" />
                  </div>
                  <p className="progress-label">{progress}</p>
                </div>
              )}

              {/* ── Background color picker (shown after done) ── */}
              {status === "done" && (
                <div className="bg-picker-section">
                  <p className="bg-picker-label">Background Color</p>
                  <div className="bg-picker-row">
                    {BG_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        className={`bg-swatch ${bgColor === preset.value ? "bg-swatch-active" : ""}`}
                        onClick={() => setBgColor(preset.value)}
                        title={preset.label}
                        style={
                          preset.value !== "transparent"
                            ? { background: preset.value }
                            : {}
                        }
                      >
                        {preset.value === "transparent" && (
                          <span className="transparent-icon">⬜</span>
                        )}
                      </button>
                    ))}
                    {/* Custom color */}
                    <label
                      className="bg-swatch custom-color-swatch"
                      title="Custom color"
                    >
                      <input
                        type="color"
                        value={bgColor === "transparent" ? "#ffffff" : bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="color-input-hidden"
                      />
                      🎨
                    </label>
                  </div>
                </div>
              )}

              {/* ── Action buttons ── */}
              <div className="action-row">
                <button
                  className="change-btn-action"
                  onClick={clearImage}
                  disabled={status === "processing"}
                >
                  ✕ Change Image
                </button>

                {status !== "done" ? (
                  <button
                    className="primary-btn"
                    onClick={removeBackground}
                    disabled={status === "processing"}
                  >
                    {status === "processing" ? (
                      <>
                        <span className="btn-spinner" />
                        Processing…
                      </>
                    ) : (
                      "✂ Remove Background"
                    )}
                  </button>
                ) : (
                  <button className="primary-btn" onClick={download}>
                    ↓ Download {bgColor === "transparent" ? "PNG" : "JPG"}
                  </button>
                )}
              </div>

              {/* ── Error ── */}
              {status === "error" && (
                <div className="result-error">
                  <span>⚠</span>
                  <span>
                    {progress || "Something went wrong. Please try again."}
                  </span>
                </div>
              )}

              {/* ── First-run note ── */}
              {status === "processing" && (
                <div className="dl-notice">
                  <span>ℹ</span>
                  The AI model downloads once and is cached in your browser.
                  Subsequent uses are instant.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── How it works ── */}
        <div className="how-it-works">
          <p className="how-title">How it works</p>
          <div className="how-steps">
            <div className="how-step">
              <span className="step-num">1</span>
              <span>Upload any image — person, product, animal, object</span>
            </div>
            <div className="how-step">
              <span className="step-num">2</span>
              <span>
                Click <b>Remove Background</b> — AI runs in your browser
              </span>
            </div>
            <div className="how-step">
              <span className="step-num">3</span>
              <span>
                Pick a background color (or keep transparent), then{" "}
                <b>Download PNG</b>
              </span>
            </div>
          </div>
        </div>

        <canvas ref={resultCanvasRef} style={{ display: "none" }} />
      </div>

      <div className="cert-footer">
        Produce for your daily work.{" "}
        <a
          href="https://t.me/thany_oun"
          target="_blank"
          rel="noopener noreferrer"
        >
          Contact Dev.
        </a>
      </div>
    </div>
  );
}
