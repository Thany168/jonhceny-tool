"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { FaRobot } from "react-icons/fa";
import { PiLockKeyFill } from "react-icons/pi";
import { FaBoltLightning } from "react-icons/fa6";
import { IoArrowBackCircleOutline } from "react-icons/io5";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

import "./page.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url,
).toString();

type Status = "idle" | "processing" | "done" | "error";

interface PdfInfo {
  file: File;
  pageCount: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Check if text contains valid Khmer Unicode ──
function hasValidKhmer(text: string): boolean {
  return /[\u1780-\u17FF]/.test(text);
}

// ── Render a PDF page to a base64 PNG (for Claude vision) ──
async function renderPageToBase64(
  pdf: any,
  pageNum: number,
  scale = 2.0,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png").split(",")[1];
}

// ── Call Claude Vision API to extract text from a page image ──
async function extractTextWithClaude(
  base64Image: string,
  pageNum: number,
  totalPages: number,
  onProgress: (msg: string) => void,
): Promise<string> {
  onProgress(`Claude AI reading page ${pageNum} of ${totalPages}…`);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `You are a precise document transcription engine. Extract ALL text from this PDF page image exactly as it appears.

CRITICAL RULES:
- Preserve every Khmer word exactly with correct Unicode spelling (U+1780–U+17FF range)
- Preserve every English word exactly
- Keep the original reading order (top to bottom, left to right)
- Separate paragraphs with a blank line
- Do NOT translate, summarize, or change any word
- Do NOT add any explanation or commentary
- Output ONLY the raw extracted text, nothing else

Extract the text now:`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error on page ${pageNum}: ${err}`);
  }

  const data = await response.json();
  return data.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
}

// ── Main extraction: fast pdfjs first, Claude Vision fallback ──
async function extractText(
  file: File,
  onProgress: (msg: string) => void,
): Promise<{ pages: string[]; pageCount: number; usedAI: boolean }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer })
    .promise;
  const pageCount: number = pdf.numPages;

  // Check page 1 for valid Khmer Unicode
  onProgress("Checking text layer…");
  const page1 = await pdf.getPage(1);
  const content1 = await page1.getTextContent();
  const rawText1 = content1.items
    .filter((i: any) => "str" in i)
    .map((i: any) => i.str)
    .join(" ");

  // Fast path: PDF already has proper Unicode Khmer text
  if (hasValidKhmer(rawText1)) {
    onProgress("Unicode Khmer detected — fast extraction…");
    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      onProgress(`Extracting page ${i} of ${pageCount}…`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item: any) => "str" in item)
        .map((item: any) => item.str)
        .join(" ");
      pages.push(text);
    }
    return { pages, pageCount, usedAI: false };
  }

  // Slow path: legacy font or scanned — use Claude Vision
  onProgress("Legacy Khmer font detected — switching to Claude AI OCR…");
  const pages: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const base64 = await renderPageToBase64(pdf, i, 2.0);
    const text = await extractTextWithClaude(base64, i, pageCount, onProgress);
    pages.push(text);
  }
  return { pages, pageCount, usedAI: true };
}

// ── Build DOCX from extracted page strings ──
async function buildDocx(
  pages: string[],
  onProgress: (msg: string) => void,
): Promise<Blob> {
  onProgress("Building Word document…");

  const { Document, Packer, Paragraph, TextRun, PageBreak } =
    await import("docx");

  const children: any[] = [];

  for (let p = 0; p < pages.length; p++) {
    const paragraphs = pages[p].split(/\n\n+/).filter((t) => t.trim());

    for (const para of paragraphs) {
      const combined = para.split(/\n/).join(" ").trim();
      if (!combined) continue;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: combined,
              font: hasValidKhmer(combined) ? "Khmer OS Siemreap" : "Arial",
              size: 26,
            }),
          ],
          spacing: { after: 160 },
        }),
      );
    }

    if (p < pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  onProgress("Packing DOCX…");

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Khmer OS Siemreap", size: 26 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ─────────────────────────────────────────────
export default function PdfToDocxPage() {
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<string>("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [usedAI, setUsedAI] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("Only PDF files are supported.");
      return;
    }
    setPdfInfo({ file, pageCount: 0 });
    setResultBlob(null);
    setStatus("idle");
    setProgress("");
    setUsedAI(false);

    try {
      const ab = await file.arrayBuffer();
      const pdf = await (pdfjsLib as any).getDocument({ data: ab }).promise;
      setPdfInfo({ file, pageCount: pdf.numPages });
    } catch {
      setPdfInfo({ file, pageCount: 0 });
    }
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

  async function convert() {
    if (!pdfInfo) return;
    setStatus("processing");
    setResultBlob(null);
    setUsedAI(false);

    try {
      const {
        pages,
        pageCount,
        usedAI: didAI,
      } = await extractText(pdfInfo.file, setProgress);
      setPdfInfo((prev) => prev && { ...prev, pageCount });
      setUsedAI(didAI);

      const blob = await buildDocx(pages, setProgress);
      setResultBlob(blob);
      setStatus("done");
      setProgress("");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setProgress(err?.message || "Conversion failed. Please try again.");
    }
  }

  function download() {
    if (!resultBlob || !pdfInfo) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    a.download = pdfInfo.file.name.replace(/\.pdf$/i, "") + ".docx";
    a.click();
  }

  function clearFile() {
    setPdfInfo(null);
    setResultBlob(null);
    setStatus("idle");
    setProgress("");
    setUsedAI(false);
  }

  return (
    <div className="page-wrap">
      <div className="tool-screen">
        <div className="cert-header">
          <Link href="/" className="cert-logo">
            KHMER DIGITAL TOOLS
          </Link>
          <Link href="/" className="back-link">
            <IoArrowBackCircleOutline /> Back to Options
          </Link>
        </div>

        <h1 className="tool-title">📄 PDF to Word</h1>
        <p className="tool-subtitle">
          Convert PDF files to editable .docx · 100% in your browser · No upload
          to server
        </p>

        <div className="platform-row">
          <div className="platform-pill active-pill">
            <FaRobot />
            AI Khmer OCR
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
          {!pdfInfo ? (
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
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
              <div className="drop-hint">
                <span className="drop-icon">📄</span>
                <p className="drop-title">Drop PDF here or click to upload</p>
                <p className="drop-sub">Khmer &amp; English · PDF files only</p>
              </div>
            </div>
          ) : (
            <>
              <div className="file-preview-card">
                <div className="file-preview-icon">📄</div>
                <div className="file-preview-info">
                  <p className="file-preview-name">
                    {pdfInfo.file.name.length > 36
                      ? pdfInfo.file.name.slice(0, 34) + "…"
                      : pdfInfo.file.name}
                  </p>
                  <p className="file-preview-meta">
                    {formatSize(pdfInfo.file.size)}
                    {pdfInfo.pageCount > 0 && (
                      <>
                        {" "}
                        · {pdfInfo.pageCount} page
                        {pdfInfo.pageCount !== 1 ? "s" : ""}
                      </>
                    )}
                  </p>
                </div>
                {status === "done" && (
                  <div className="file-preview-badge">✓ Converted</div>
                )}
              </div>

              {status !== "processing" && (
                <div className="convert-arrow">
                  <span className="arrow-label">PDF</span>
                  <span className="arrow-icon">→</span>
                  <span className="arrow-label">DOCX</span>
                </div>
              )}

              {status === "processing" && (
                <div className="progress-wrap">
                  <div className="progress-track">
                    <div className="progress-fill animated" />
                  </div>
                  <p className="progress-label">{progress}</p>
                </div>
              )}

              {status === "done" && resultBlob && (
                <div className="result-success">
                  <span className="result-success-icon">✓</span>
                  <div>
                    <p className="result-success-title">Ready to download</p>
                    <p className="result-success-sub">
                      {pdfInfo.file.name.replace(/\.pdf$/i, "")}.docx ·{" "}
                      {formatSize(resultBlob.size)}
                      {usedAI && " · Claude AI OCR"}
                    </p>
                  </div>
                </div>
              )}

              <div className="action-row">
                <button
                  className="change-btn-action"
                  onClick={clearFile}
                  disabled={status === "processing"}
                >
                  ✕ Change File
                </button>

                {status !== "done" ? (
                  <button
                    className="primary-btn"
                    onClick={convert}
                    disabled={status === "processing"}
                  >
                    {status === "processing" ? (
                      <>
                        <span className="btn-spinner" />
                        Converting…
                      </>
                    ) : (
                      "📄 Convert to Word"
                    )}
                  </button>
                ) : (
                  <button className="primary-btn" onClick={download}>
                    ↓ Download DOCX
                  </button>
                )}
              </div>

              {status === "error" && (
                <div className="result-error">
                  <span>⚠</span>
                  <span>
                    {progress || "Conversion failed. Please try another PDF."}
                  </span>
                </div>
              )}

              {status === "processing" && (
                <div className="dl-notice">
                  <span>ℹ</span>
                  {usedAI
                    ? "Claude AI is reading each page — highest accuracy Khmer extraction."
                    : "Processing… the file never leaves your device."}
                </div>
              )}
            </>
          )}
        </div>

        <div className="how-it-works">
          <p className="how-title">How it works</p>
          <div className="how-steps">
            <div className="how-step">
              <span className="step-num">1</span>
              <span>Upload any PDF with Khmer or English text</span>
            </div>
            <div className="how-step">
              <span className="step-num">2</span>
              <span>
                Legacy Khmer fonts are automatically read by{" "}
                <b>Claude AI vision</b> — perfect Unicode spelling every time
              </span>
            </div>
            <div className="how-step">
              <span className="step-num">3</span>
              <span>
                <b>Download DOCX</b> — Khmer OS Siemreap font, ready for Word or
                Google Docs
              </span>
            </div>
          </div>
          <p className="how-note">
            ⚠ AI OCR activates automatically for legacy Khmer font PDFs. First
            run requires an Anthropic API key set in your environment.
          </p>
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
