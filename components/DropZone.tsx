"use client";

import { useRef } from "react";
import { MdCancel } from "react-icons/md";
import { FaFileUpload } from "react-icons/fa";
import "./DropZone.css";

interface ImageFile {
  file: File;
  url: string;
  width: number;
  height: number;
}

interface DropZoneProps {
  image: ImageFile | null;
  isDragging: boolean;
  onFile: (file: File) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onClear: () => void;
}

export default function DropZone({
  image,
  isDragging,
  onFile,
  onDragOver,
  onDragLeave,
  onClear,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    onDragLeave();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`drop-zone ${isDragging ? "drag-over" : ""} ${image ? "has-image" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onClick={() => !image && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {image ? (
        <div className="image-preview-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="preview" className="preview-img" />
          <button
            className="change-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <MdCancel />
            Change
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
  );
}
