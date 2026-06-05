import "./Metabar.css";

interface MetaBarProps {
  pills: { label: string; value: string }[];
}

export default function MetaBar({ pills }: MetaBarProps) {
  return (
    <div className="meta-bar">
      {pills.map((p, i) => (
        <span key={i} className="meta-pill">
          {p.label && <>{p.label}: </>}
          <b>{p.value}</b>
        </span>
      ))}
    </div>
  );
}
