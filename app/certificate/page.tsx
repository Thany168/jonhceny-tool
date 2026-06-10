"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import "./page.css";
import { FaAward } from "react-icons/fa6";

interface Template {
  id: string;
  label: string;
  src: string;
  nameY: number;
  companyY: number;
  dateY: number;
  nameMaxWidth: number;
  companyMaxWidth: number;
  nameStartSize: number;
  companyStartSize: number;
  nameColor: string;
  companyColor: string;
  dateColor: string;
}

const TEMPLATES: Template[] = [
  {
    id: "template1",
    label: "Template 1",
    src: "/templates/template1.png",
    nameY: 1000,
    companyY: 1495,
    dateY: 1720,
    nameMaxWidth: 1150,
    companyMaxWidth: 1650,
    nameStartSize: 300,
    companyStartSize: 250,
    // ── Colors ──
    nameColor: "#165eff",
    companyColor: "#165eff",
    dateColor: "#555555",
  },
  {
    id: "template2",
    label: "Template 2",
    src: "/templates/template2.png",
    nameY: 600,
    companyY: 950,
    dateY: 1700,
    nameMaxWidth: 1100,
    companyMaxWidth: 1600,
    nameStartSize: 130,
    companyStartSize: 130,
    // ── Colors ──
    nameColor: "#c9a84c",
    companyColor: "#c9a84c",
    dateColor: "#666666",
  },
];

interface TemplateOverrides {
  nameFontSize: number;
  nameY: number;
  companyFontSize: number;
  companyY: number;
}

function defaultOverrides(t: Template): TemplateOverrides {
  return {
    nameFontSize: t.nameStartSize,
    nameY: t.nameY,
    companyFontSize: t.companyStartSize,
    companyY: t.companyY,
  };
}

const isKhmer = (text: string) => /[\u1780-\u17FF]/.test(text);
const pickFont = (text: string) => (isKhmer(text) ? "Kantumruy Pro" : "Exo 2");

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fontFamily: string,
  fontWeight: string,
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${fontWeight} ${size}px "${fontFamily}"`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1.5;
  }
  return minSize;
}

function getOrdinal(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function drawDateWithSuperscript(
  ctx: CanvasRenderingContext2D,
  dateStr: string,
  cx: number,
  y: number,
  color: string,
  baseFontSize: number = 48,
) {
  if (!dateStr) return;

  const d = new Date(dateStr);
  const day = d.getDate();
  const ordinal = getOrdinal(day);
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();

  const baseFont = `Georgia, "Times New Roman", serif`;
  const superSize = Math.round(baseFontSize * 0.55);
  const superRise = Math.round(baseFontSize * 0.48);

  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  ctx.font = `${baseFontSize}px ${baseFont}`;
  const dayStr = String(day);
  const dayW = ctx.measureText(dayStr).width;

  ctx.font = `${superSize}px ${baseFont}`;
  const ordW = ctx.measureText(ordinal).width;

  ctx.font = `${baseFontSize}px ${baseFont}`;
  const rest = ` ${month} ${year}`;
  const restW = ctx.measureText(rest).width;

  const totalW = dayW + ordW + restW;
  let x = cx - totalW / 2;

  ctx.font = `${baseFontSize}px ${baseFont}`;
  ctx.fillText(dayStr, x, y);
  x += dayW;

  ctx.font = `${superSize}px ${baseFont}`;
  ctx.fillText(ordinal, x, y - superRise);
  x += ordW;

  ctx.font = `${baseFontSize}px ${baseFont}`;
  ctx.fillText(rest, x, y);

  ctx.textAlign = "center";
}

export default function CertificatePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selected, setSelected] = useState<Template>(TEMPLATES[0]);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState("");

  // Map of per-template overrides — each template remembers its own values
  const [overridesMap, setOverridesMap] = useState<
    Record<string, TemplateOverrides>
  >(() =>
    Object.fromEntries(TEMPLATES.map((t) => [t.id, defaultOverrides(t)])),
  );

  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Current template's overrides (shortcut)
  const overrides = overridesMap[selected.id];

  // Update a single field for the current template
  function setOverride<K extends keyof TemplateOverrides>(
    key: K,
    value: TemplateOverrides[K],
  ) {
    setOverridesMap((prev) => ({
      ...prev,
      [selected.id]: { ...prev[selected.id], [key]: value },
    }));
    setGenerated(false);
  }

  // Switch template — restores that template's saved overrides
  function selectTemplate(t: Template) {
    setSelected(t);
    setGenerated(false);
    // If the template has never been customised, ensure defaults are loaded
    setOverridesMap((prev) => ({
      ...prev,
      [t.id]: prev[t.id] ?? defaultOverrides(t),
    }));
  }

  // Reset current template's overrides back to its defaults
  function resetOverrides() {
    setOverridesMap((prev) => ({
      ...prev,
      [selected.id]: defaultOverrides(selected),
    }));
    setGenerated(false);
  }

  const generateCertificate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    setGenerating(true);

    await document.fonts.ready;

    const image = new Image();
    image.src = selected.src;

    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const cx = canvas.width / 2;

      const nameFont = pickFont(name);
      const displayName = isKhmer(name) ? name : name.toUpperCase();
      const nameWeight = isKhmer(name) ? "700" : "800";
      const finalNameSize = fitText(
        ctx,
        displayName,
        selected.nameMaxWidth,
        overrides.nameFontSize,
        55,
        nameFont,
        nameWeight,
      );
      ctx.fillStyle = selected.nameColor;
      ctx.font = `${nameWeight} ${finalNameSize}px "${nameFont}"`;
      ctx.fillText(displayName, cx, overrides.nameY);

      // ── Company ──
      const companyFont = pickFont(company);
      const displayCompany = isKhmer(company) ? company : company.toUpperCase();
      const finalCompanySize = fitText(
        ctx,
        displayCompany,
        selected.companyMaxWidth,
        overrides.companyFontSize,
        42,
        companyFont,
        "700",
      );
      ctx.fillStyle = selected.companyColor;
      ctx.font = `700 ${finalCompanySize}px "${companyFont}"`;
      ctx.fillText(displayCompany, cx, overrides.companyY);

      drawDateWithSuperscript(
        ctx,
        date,
        cx,
        selected.dateY,
        selected.dateColor,
        48,
      );

      setGenerated(true);
      setGenerating(false);
    };

    image.onerror = () => {
      setGenerating(false);
      alert(
        `Template image not found:\n${selected.src}\n\nAdd your PNG files to /public/templates/`,
      );
    };
  };

  const downloadJpg = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${name.replace(/[^a-zA-Z0-9\u1780-\u17FF]/g, "_") || "certificate"}.jpg`;
    a.href = canvas.toDataURL("image/jpeg", 0.98);
    a.click();
  };

  const canGenerate = name.trim() && company.trim() && date;

  return (
    <div className="page-wrap">
      <div className="tool-screen">
        {/* ── Header ── */}
        <div className="cert-header">
          <Link href="/" className="cert-logo">
            KHMER DIGITAL TOOLS
          </Link>
          <Link href="/" className="back-link">
            Back to Options
          </Link>
        </div>

        <h1 className="tool-title">Generate Certificate</h1>
        <p className="tool-subtitle">
          Pick a template · fill details · download JPG
        </p>

        {/* ── Template Tabs ── */}
        <div className="template-row">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={`tmpl-btn ${selected.id === t.id ? "tmpl-active" : ""}`}
              onClick={() => selectTemplate(t)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="generator-layout">
          {/* ── Left: Form ── */}
          <div className="tool-card">
            <div className="cert-form">
              <div className="cert-field">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="Enter recipient name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setGenerated(false);
                  }}
                />
                <small>Supports Khmer · auto-shrinks if too long</small>
              </div>

              <div className="cert-field">
                <label>Company / Organization</label>
                <input
                  type="text"
                  placeholder="Enter company name"
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    setGenerated(false);
                  }}
                />
              </div>

              <div className="cert-field">
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setGenerated(false);
                  }}
                />
              </div>

              {/* Advanced — values are per-template */}
              <details className="advanced-settings">
                <summary>
                  Advanced Position &amp; Size — {selected.label}
                </summary>
                <div className="settings-grid">
                  <div className="cert-field">
                    <label>Name Font Size (px)</label>
                    <input
                      type="number"
                      value={overrides.nameFontSize}
                      onChange={(e) =>
                        setOverride("nameFontSize", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="cert-field">
                    <label>Name Y Position</label>
                    <input
                      type="number"
                      value={overrides.nameY}
                      onChange={(e) =>
                        setOverride("nameY", Number(e.target.value))
                      }
                    />
                    <small>Higher = move down</small>
                  </div>
                  <div className="cert-field">
                    <label>Company Font Size (px)</label>
                    <input
                      type="number"
                      value={overrides.companyFontSize}
                      onChange={(e) =>
                        setOverride("companyFontSize", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="cert-field">
                    <label>Company Y Position</label>
                    <input
                      type="number"
                      value={overrides.companyY}
                      onChange={(e) =>
                        setOverride("companyY", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                {/* Reset button */}
                <button
                  onClick={resetOverrides}
                  style={{
                    marginTop: "10px",
                    fontSize: "12px",
                    color: "var(--text-dim)",
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  ↺ Reset to {selected.label} defaults
                </button>
              </details>

              <div className="cert-actions">
                <button
                  className="primary-btn"
                  onClick={generateCertificate}
                  disabled={!canGenerate || generating}
                >
                  {generating ? "Generating…" : "Generate Certificate"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={downloadJpg}
                  disabled={!generated}
                >
                  ↓ Download JPG
                </button>
              </div>

              {!canGenerate && (
                <p className="form-warn">⚠ Fill in Name, Company, and Date.</p>
              )}
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div className="preview-container">
            <canvas
              ref={canvasRef}
              style={{ display: generated ? "block" : "none" }}
              className="certificate-canvas"
            />
            {generated ? (
              <p className="preview-hint">← Click Download JPG to save</p>
            ) : (
              <div className="preview-empty">
                <span>
                  <FaAward />
                </span>
                <p>
                  Fill the form and click
                  <br />
                  <b>Generate Certificate</b>
                </p>
              </div>
            )}
          </div>
        </div>
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
