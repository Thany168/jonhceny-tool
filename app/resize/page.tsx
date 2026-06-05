"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import DropZone from "@/components/DropZone";
import MetaBar from "@/components/MetaBar";
import ProgressBar from "@/components/ProgressBar";
import ResultBar from "@/components/ResultBar";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import "./page.css";

interface ImageFile {
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
      });
    img.onerror = reject;
    img.src = url;
  });
}

export default function ResizePage() {
  const [image, setImage] = useState<ImageFile | null>(null);
  const [targetW, setTargetW] = useState(0);
  const [targetH, setTargetH] = useState(0);
  const [keepAspect, setKeepAspect] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [resultUrl, setResultUrl] = useState("");
  const [resultSize, setResultSize] = useState("");
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

  function clearImage() {
    setImage(null);
    setResultUrl("");
    setStatus("idle");
  }

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
    <div className="page-wrap">
      <Link href="/" className="logo-row">
        <span className="logo-text">Khmer Digital Tools</span>
      </Link>

      <div className="tool-screen">
        <Link href="/" className="back-btn">
          <IoArrowBackCircleOutline />
          Back to Options
        </Link>

        <div className="tool-header">
          <h1 className="tool-title">Resize Dimensions</h1>
          <p className="tool-sub">Plan, Action, Focus, Achievement, Relax.</p>
        </div>

        <div className="tool-card">
          <DropZone
            image={image}
            isDragging={isDragging}
            onFile={handleFile}
            onDragOver={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onClear={clearImage}
          />

          {image && (
            <MetaBar
              pills={[
                {
                  label: "Original",
                  value: `${image.width} × ${image.height} px`,
                },
                { label: "", value: formatSize(image.file.size) },
              ]}
            />
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
                Maintain aspect ratio — tick to keep clear graphic
              </label>
            </>
          )}

          {status === "processing" && <ProgressBar />}

          {status === "done" && resultUrl && (
            <ResultBar
              label={`${targetW} × ${targetH} px`}
              badge={` ${resultSize}`}
              badgeOk={true}
              onDownload={download}
            />
          )}
        </div>
      </div>

      <p className="footer">
        Produce for your daily work.{" "}
        <a
          href="https://t.me/thany_oun"
          target="_blank"
          rel="noopener noreferrer"
        >
          Contact Dev.
        </a>
      </p>
    </div>
  );
}
