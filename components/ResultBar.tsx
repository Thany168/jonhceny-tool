import "./Resultbar.css";
import { FaCloudDownloadAlt } from "react-icons/fa";
import { ReactNode } from "react";

interface ResultBarProps {
  label: string;
  badge: ReactNode;
  badgeOk: boolean;
  onDownload: () => void;
}

export default function ResultBar({
  label,
  badge,
  badgeOk,
  onDownload,
}: ResultBarProps) {
  return (
    <div className="result-bar">
      <div className="result-info">
        <span className="result-label">Result</span>
        <span className="result-size">{label}</span>
        <span className={`result-badge ${badgeOk ? "badge-ok" : "badge-warn"}`}>
          {badge}
        </span>
      </div>

      <button className="download-btn" onClick={onDownload}>
        <FaCloudDownloadAlt />
        Download
      </button>
    </div>
  );
}
