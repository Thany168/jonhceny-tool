import "./Progressbar.css";

interface ProgressBarProps {
  label?: string;
}

export default function ProgressBar({ label }: ProgressBarProps) {
  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" />
      </div>
      {label && <p className="progress-label">{label}</p>}
    </div>
  );
}
