"use client";

import { useState, useRef, useCallback } from "react";
import { MdCancel } from "react-icons/md";
import { FaFileUpload } from "react-icons/fa";
import { MdOutlinePhotoSizeSelectActual } from "react-icons/md";
import { SiConvertio } from "react-icons/si";

import "./page.css";

type Tool = "compress" | "resize" | null;

interface ImageFile {
  file: File;
  url: string;
  width: number;
  height: number;
  sizeKB: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImageFile(file: File): Promise<ImageFile> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        file,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        sizeKB: file.size / 1024,
      });
    img.onerror = reject;
    img.src = url;
  });
}

function CompressTool() {
  const [image, setImage] = useState<ImageFile | null>(null);
  const [targetKB, setTargetKB] = useState<number>(300);
  const [status, setStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/image\/(png|jpe?g|webp)/)) return;
    const img = await loadImageFile(file);
    setImage(img);
    setResultBlob(null);
    setStatus("idle");
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

  async function compress() {
    if (!image) return;
    setStatus("processing");
    setProgress("Initialising canvas…");

    try {
      const img = new Image();
      img.src = image.url;
      await new Promise((r) => (img.onload = r));

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0);

      const targetBytes = targetKB * 1024;
      let lo = 0.01,
        hi = 1.0,
        best: Blob | null = null;

      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        setProgress(
          `Iteration ${i + 1}/20 — quality ${(mid * 100).toFixed(0)}%`,
        );
        const blob: Blob = await new Promise((res, rej) =>
          canvas.toBlob(
            (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
            "image/jpeg",
            mid,
          ),
        );
        if (blob.size <= targetBytes) {
          best = blob;
          lo = mid;
        } else {
          hi = mid;
        }
        if (hi - lo < 0.005) break;
      }

      if (!best) {
        best = await new Promise((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.01),
        );
      }

      setResultBlob(best!);
      setResultSize(best!.size);
      setStatus("done");
      setProgress("");
    } catch {
      setStatus("error");
      setProgress("Something went wrong.");
    }
  }

  function download() {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compressed_${image?.file.name ?? "image"}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tool-card">
      <div
        ref={dropRef}
        className={`drop-zone ${isDragging ? "drag-over" : ""} ${image ? "has-image" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !image && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {image ? (
          <div className="image-preview-wrap">
            <img src={image.url} alt="preview" className="preview-img" />
            <button
              className="change-btn "
              onClick={(e) => {
                e.stopPropagation();
                setImage(null);
                setResultBlob(null);
                setStatus("idle");
              }}
            >
              <MdCancel />
              Change
            </button>
          </div>
        ) : (
          <div className="drop-hint">
            <span className="drop-icon">
              {" "}
              <FaFileUpload />
            </span>
            <p className="drop-title">Drop image here</p>
            <p className="drop-sub">PNG · JPG · JPEG · WebP</p>
          </div>
        )}
      </div>

      {image && (
        <div className="meta-bar">
          <span className="meta-pill">
            Original: <b>{formatSize(image.file.size)}</b>
          </span>
          <span className="meta-pill">
            {image.width} × {image.height} px
          </span>
        </div>
      )}

      {image && (
        <div className="controls-row">
          <div className="input-group">
            <label>Target Size (KB)</label>
            <input
              type="number"
              min={10}
              max={10000}
              value={targetKB}
              onChange={(e) => setTargetKB(Number(e.target.value))}
              className="num-input"
            />
          </div>
          <button
            className="action-btn"
            onClick={compress}
            disabled={status === "processing"}
          >
            {status === "processing" ? "Optimising…" : "Optimize"}
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="progress-bar-wrap">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" />
          </div>
          <p className="progress-label">{progress}</p>
        </div>
      )}

      {status === "done" && resultBlob && (
        <div className="result-bar">
          <div className="result-info">
            <span className="result-label">Result</span>
            <span className="result-size">{formatSize(resultSize)}</span>
            <span
              className={`result-badge ${resultSize / 1024 <= targetKB ? "badge-ok" : "badge-warn"}`}
            >
              {resultSize / 1024 <= targetKB
                ? " Under target"
                : " Slightly over"}
            </span>
          </div>
          <button className="download-btn" onClick={download}>
            ↓ Download
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Resize Tool ──────────────────────────────────────────────────────────────

function ResizeTool() {
  const [image, setImage] = useState<ImageFile | null>(null);
  const [targetW, setTargetW] = useState<number>(0);
  const [targetH, setTargetH] = useState<number>(0);
  const [keepAspect, setKeepAspect] = useState(true);
  const [status, setStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [resultSize, setResultSize] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aspectRef = useRef(1);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/image\/(png|jpe?g|webp)/)) return;
    const img = await loadImageFile(file);
    setImage(img);
    setTargetW(img.width);
    setTargetH(img.height);
    aspectRef.current = img.width / img.height;
    setResultUrl("");
    setStatus("idle");
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

  function handleWidth(val: number) {
    setTargetW(val);
    if (keepAspect) setTargetH(Math.round(val / aspectRef.current));
  }
  function handleHeight(val: number) {
    setTargetH(val);
    if (keepAspect) setTargetW(Math.round(val * aspectRef.current));
  }

  async function resize() {
    if (!image) return;
    setStatus("processing");
    try {
      const img = new Image();
      img.src = image.url;
      await new Promise((r) => (img.onload = r));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const url = canvas.toDataURL("image/png");
      const approxKB = Math.round((url.length * 3) / 4 / 1024);
      setResultUrl(url);
      setResultSize(`~${approxKB} KB`);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `resized_${image?.file.name ?? "image"}.png`;
    a.click();
  }

  return (
    <div className="tool-card">
      <div
        ref={dropRef}
        className={`drop-zone ${isDragging ? "drag-over" : ""} ${image ? "has-image" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !image && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {image ? (
          <div className="image-preview-wrap">
            <img src={image.url} alt="preview" className="preview-img" />
            <button
              className="change-btn"
              onClick={(e) => {
                e.stopPropagation();
                setImage(null);
                setResultUrl("");
                setStatus("idle");
              }}
            >
              <MdCancel /> Change
            </button>
          </div>
        ) : (
          <div className="drop-hint">
            <span className="drop-icon">
              <FaFileUpload />
            </span>
            <p className="drop-title">Drop image here</p>
            <p className="drop-sub">PNG · JPG · JPEG · WebP</p>
          </div>
        )}
      </div>

      {image && (
        <div className="meta-bar">
          <span className="meta-pill">
            Original:{" "}
            <b>
              {image.width} × {image.height} px
            </b>
          </span>
          <span className="meta-pill">{formatSize(image.file.size)}</span>
        </div>
      )}

      {image && (
        <>
          <div className="controls-row">
            <div className="input-group">
              <label>Width (px)</label>
              <input
                type="number"
                min={1}
                value={targetW}
                onChange={(e) => handleWidth(Number(e.target.value))}
                className="num-input"
              />
            </div>
            <div className="dim-sep">×</div>
            <div className="input-group">
              <label>Height (px)</label>
              <input
                type="number"
                min={1}
                value={targetH}
                onChange={(e) => handleHeight(Number(e.target.value))}
                className="num-input"
              />
            </div>
            <button
              className="action-btn"
              onClick={resize}
              disabled={status === "processing"}
            >
              {status === "processing" ? "Resizing…" : "Resize"}
            </button>
          </div>

          <label className="aspect-toggle">
            <input
              type="checkbox"
              checked={keepAspect}
              onChange={(e) => setKeepAspect(e.target.checked)}
            />
            <span className="aspect-box" />
            Maintain aspect ratio - tick to keep clear grapic
          </label>
        </>
      )}

      {status === "processing" && (
        <div className="progress-bar-wrap">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" />
          </div>
        </div>
      )}

      {status === "done" && resultUrl && (
        <div className="result-bar">
          <div className="result-info">
            <span className="result-label">Result</span>
            <span className="result-size">
              {targetW} × {targetH} px
            </span>
            <span className="result-badge badge-ok">✓ {resultSize}</span>
          </div>
          <button className="download-btn" onClick={download}>
            ↓ Download
          </button>
        </div>
      )}
    </div>
  );
}
export default function Home() {
  const [tool, setTool] = useState<Tool>(null);

  return (
    <>
      <div className="page-wrap">
        <div className="logo-row">
          <span className="logo-text">Khmer's blood</span>
        </div>

        {tool === null && (
          <div className="select-screen">
            <span className="select-heading">Choose a tool to get started</span>
            <div className="cards-row">
              <div className="choice-card" onClick={() => setTool("compress")}>
                <span className="card-icon">
                  <MdOutlinePhotoSizeSelectActual />
                </span>
                <div>
                  <p className="card-title">Compress Image Size</p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--amber)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.08em",
                      marginTop: "4px",
                    }}
                  >
                    KB
                  </p>
                </div>
                <p className="card-desc">
                  Reduce size ,Just Upload image and downlooad it.
                </p>
                <span className="card-arrow">→</span>
              </div>

              <div className="choice-card" onClick={() => setTool("resize")}>
                <span className="card-icon">
                  <SiConvertio />
                </span>
                <div>
                  <p className="card-title">Resize Dimensions</p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--amber)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.08em",
                      marginTop: "4px",
                    }}
                  >
                    PX
                  </p>
                </div>
                <p className="card-desc">Convert with high-quality smoothing</p>
                <span className="card-arrow">→</span>
              </div>
            </div>
          </div>
        )}

        {tool !== null && (
          <div className="tool-screen">
            <button className="back-btn" onClick={() => setTool(null)}>
              Back to Options
            </button>

            <div className="tool-header">
              <h1 className="tool-title">
                {tool === "compress"
                  ? " Compress Image Size"
                  : " Resize Dimensions"}
              </h1>
              <p className="tool-sub">
                {tool === "compress"
                  ? "Enjoy ur work Guys."
                  : "Plan , Action , Focus , Achievement , Relax"}
              </p>
            </div>

            {tool === "compress" && <CompressTool />}
            {tool === "resize" && <ResizeTool />}
          </div>
        )}

        <p className="footer">
          Produce for you Daily work.{" "}
          <a href="https://t.me/thany_oun">Contact Dev.</a>
        </p>
      </div>
    </>
  );
}
