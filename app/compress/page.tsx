"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import DropZone from "@/components/DropZone";
import MetaBar from "@/components/MetaBar";
import ProgressBar from "@/components/ProgressBar";
import ResultBar from "@/components/ResultBar";
import { MdCheckCircle, MdWarning } from "react-icons/md";
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

export default function CompressPage() {
  const [image, setImage] = useState<ImageFile | null>(null);
  const [targetKB, setTargetKB] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "processing" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultSize, setResultSize] = useState(0);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/image\/(png|jpe?g|webp)/)) return;
    setImage(await loadImageFile(file));
    setResultBlob(null);
    setStatus("idle");
  }, []);

  function clearImage() {
    setImage(null);
    setResultBlob(null);
    setStatus("idle");
  }

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
          canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", mid),
        );
        if (blob.size <= targetBytes) {
          best = blob;
          lo = mid;
        } else hi = mid;
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

  const underTarget = resultSize / 1024 <= targetKB;

  return (
    <div className="page-wrap">
      <Link href="/" className="logo-row">
        <span className="logo-text">Khmer Digital Tools</span>
      </Link>

      <div className="tool-screen">
        <Link href="/" className="back-btn flex items-center">
          <IoArrowBackCircleOutline />
          Back to Options
        </Link>

        <div className="tool-header">
          <h1 className="tool-title">Compress Image Size</h1>
          <p className="tool-sub">Enjoy ur work Guys.</p>
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
                { label: "Original", value: formatSize(image.file.size) },
                { label: "", value: `${image.width} × ${image.height} px` },
              ]}
            />
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

          {status === "processing" && <ProgressBar label={progress} />}

          {status === "done" && resultBlob && (
            <ResultBar
              label={formatSize(resultSize)}
              badge={
                underTarget ? (
                  <>
                    <MdCheckCircle /> Under target
                  </>
                ) : (
                  <>
                    <MdWarning /> Slightly over
                  </>
                )
              }
              badgeOk={underTarget}
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
