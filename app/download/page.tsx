"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import { GoVideo } from "react-icons/go";
import { BsMusicNoteBeamed, BsCameraVideo } from "react-icons/bs";
import { FaRegFileAudio } from "react-icons/fa";
import { CiWarning } from "react-icons/ci";

import "./page.css";

type Status = "idle" | "loading" | "done" | "error";
type MediaType = "video" | "audio";

interface DownloadResult {
  url: string;
  filename: string;
  picker: { url: string; type: string }[] | null;
}

const VIDEO_QUALITIES = [
  "144p",
  "240p",
  "360p",
  "480p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];
const AUDIO_QUALITIES = ["128kbps", "192kbps", "256kbps", "320kbps"];

function detectPlatform(
  url: string,
): "youtube" | "facebook" | "tiktok" | "unknown" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("facebook.com") || url.includes("fb.watch"))
    return "facebook";
  if (url.includes("tiktok.com")) return "tiktok";
  return "unknown";
}

const PLATFORM_META = {
  youtube: { label: "YouTube", color: "#ff4444", dot: "#ff0000" },
  facebook: { label: "Facebook", color: "#4d9fff", dot: "#1877f2" },
  tiktok: { label: "TikTok", color: "#69c9d0", dot: "#69c9d0" },
  unknown: { label: "", color: "#71717a", dot: "#71717a" },
};

export default function DownloadPage() {
  const [url, setUrl] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("video");
  const [selectedQuality, setSelectedQuality] = useState("720p");
  const [selectedAudioQuality, setSelectedAudioQuality] = useState("192kbps");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const platform = detectPlatform(url);
  const meta = PLATFORM_META[platform];
  const canFetch = url.trim().length > 0 && platform !== "unknown";

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
      setResult(null);
      setStatus("idle");
    } catch {
      inputRef.current?.focus();
    }
  }

  function handleClear() {
    setUrl("");
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    inputRef.current?.focus();
  }

  async function handleFetch() {
    if (!canFetch) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          mediaType,
          quality:
            mediaType === "video" ? selectedQuality : selectedAudioQuality,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
    } catch {
      setErrorMsg("Network error. Check your connection and try again.");
      setStatus("error");
    }
  }

  function handleDownload(downloadUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canFetch && status !== "loading") handleFetch();
  }

  return (
    <div className="page-wrap">
      <div className="tool-screen">
        {/* Header */}
        <div className="cert-header">
          <Link href="/" className="cert-logo">
            KHMER DIGITAL TOOLS
          </Link>
          <Link href="/" className="back-link">
            <IoArrowBackCircleOutline /> Back to Options
          </Link>
        </div>

        <h1 className="tool-title">Video Downloader</h1>
        <p className="tool-subtitle">
          Choose your format and quality — then fetch and download.
        </p>

        {/* Platform badges */}
        <div className="platform-row">
          {(["youtube", "facebook", "tiktok"] as const).map((p) => (
            <div
              key={p}
              className={`platform-pill ${platform === p ? "active" : ""}`}
              style={
                platform === p
                  ? {
                      borderColor: PLATFORM_META[p].dot,
                      color: PLATFORM_META[p].color,
                    }
                  : {}
              }
            >
              <span
                className="platform-dot"
                style={
                  platform === p ? { background: PLATFORM_META[p].dot } : {}
                }
              />
              {PLATFORM_META[p].label}
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="tool-card">
          <div className="dl-notice">
            <span className="notice-icon">ℹ</span>
            No login required ·
          </div>

          {/* Step 1 — URL */}
          <div className="step-label">
            <span className="step-num">1</span> Paste video link
          </div>
          <div className="url-row">
            <div className="url-input-wrap">
              <input
                ref={inputRef}
                type="text"
                className="url-input"
                placeholder="Paste YouTube, Facebook or TikTok URL…"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setResult(null);
                  setStatus("idle");
                }}
                onKeyDown={handleKeyDown}
                spellCheck={false}
              />
              {url && (
                <button
                  className="clear-btn"
                  onClick={handleClear}
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
            <button className="paste-btn" onClick={handlePaste}>
              Paste
            </button>
          </div>
          {url.trim() && platform === "unknown" && (
            <p className="platform-warn">
              <CiWarning /> Only YouTube, Facebook, and TikTok links are
              supported.
            </p>
          )}

          {/* Step 2 — Type & Quality */}
          <div className="step-label">
            <span className="step-num">2</span> Choose format &amp; quality
          </div>

          {/* Video / Audio toggle */}
          <div className="type-toggle">
            <button
              className={`type-btn ${mediaType === "video" ? "active" : ""}`}
              onClick={() => {
                setMediaType("video");
                setResult(null);
                setStatus("idle");
              }}
            >
              <GoVideo /> Video
            </button>
            <button
              className={`type-btn ${mediaType === "audio" ? "active" : ""}`}
              onClick={() => {
                setMediaType("audio");
                setResult(null);
                setStatus("idle");
              }}
            >
              <FaRegFileAudio /> Audio only
            </button>
          </div>

          {/* Quality grid */}
          {mediaType === "video" ? (
            <div className="quality-grid">
              {VIDEO_QUALITIES.map((q) => (
                <button
                  key={q}
                  className={`quality-btn ${selectedQuality === q ? "active" : ""} ${q === "720p" || q === "1080p" ? "highlight" : ""}`}
                  onClick={() => {
                    setSelectedQuality(q);
                    setResult(null);
                    setStatus("idle");
                  }}
                >
                  {q}
                  {q === "720p" && <span className="quality-tag">HD</span>}
                  {q === "1080p" && <span className="quality-tag">FHD</span>}
                  {q === "1440p" && <span className="quality-tag">2K</span>}
                  {q === "2160p" && <span className="quality-tag">4K</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="quality-grid audio-grid">
              {AUDIO_QUALITIES.map((q) => (
                <button
                  key={q}
                  className={`quality-btn ${selectedAudioQuality === q ? "active" : ""} ${q === "192kbps" ? "highlight" : ""}`}
                  onClick={() => {
                    setSelectedAudioQuality(q);
                    setResult(null);
                    setStatus("idle");
                  }}
                >
                  {q}
                  {q === "192kbps" && <span className="quality-tag">REC</span>}
                  {q === "320kbps" && <span className="quality-tag">HQ</span>}
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — Fetch */}
          <div className="step-label">
            <span className="step-num">3</span> Fetch &amp; download
          </div>

          <button
            className="fetch-btn"
            onClick={handleFetch}
            disabled={!canFetch || status === "loading"}
          >
            {status === "loading" ? (
              <>
                <span className="spinner" /> Fetching…
              </>
            ) : (
              `Fetch ${mediaType === "audio" ? "Audio" : "Video"} · ${mediaType === "video" ? selectedQuality : selectedAudioQuality}`
            )}
          </button>

          {/* Error */}
          {status === "error" && (
            <div className="result-error">
              <span>
                <CiWarning />
              </span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result — single clean download */}
          {status === "done" && result && (
            <div className="result-box">
              <div className="result-header">
                <span
                  className="result-badge"
                  style={{ color: meta.color, borderColor: meta.dot }}
                >
                  <span
                    className="platform-dot"
                    style={{ background: meta.dot }}
                  />
                  {meta.label}
                </span>
                <span className="result-ready"> Ready</span>
              </div>

              <p className="result-filename">
                {mediaType === "audio" ? (
                  <BsMusicNoteBeamed />
                ) : (
                  <BsCameraVideo />
                )}{" "}
                {result.filename}
              </p>
              <p className="result-quality-line">
                {mediaType === "video" ? selectedQuality : selectedAudioQuality}{" "}
                · {mediaType === "video" ? "MP4" : "MP3/M4A"}
              </p>

              <button
                className="download-btn"
                onClick={() => handleDownload(result.url, result.filename)}
              >
                Download {mediaType === "audio" ? "Audio" : "Video"}
              </button>

              <p className="result-note">
                If download doesn&apos;t start, right-click → &ldquo;Save link
                as…&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="cert-footer">
        Produced for your daily work.{" "}
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
