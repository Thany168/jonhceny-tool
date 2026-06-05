import Link from "next/link";
import { MdOutlinePhotoSizeSelectActual } from "react-icons/md";
import { RiAiGenerate2 } from "react-icons/ri";

import { SiConvertio } from "react-icons/si";
import "./page.css";

export default function Home() {
  return (
    <div className="page-wrap">
      <Link href="/" className="logo-row">
        <span className="logo-text">Khmer Digital Tools</span>
      </Link>

      <div className="select-screen">
        <span className="select-heading">Choose a tool to get started</span>

        <div className="cards-row">
          {/* 1 */}
          <Link href="/compress" className="choice-card">
            <span className="card-icon">
              <MdOutlinePhotoSizeSelectActual />
            </span>
            <div>
              <p className="card-title">Compress Image Size</p>
              <p className="card-tag">KB</p>
            </div>
            <p className="card-desc">
              Upload your image, compress it, and download it.
            </p>
            <span className="card-arrow">→</span>
          </Link>
          {/* 2 */}
          <Link href="/resize" className="choice-card">
            <span className="card-icon">
              <SiConvertio />
            </span>
            <div>
              <p className="card-title">Resize Dimensions</p>
              <p className="card-tag">PX</p>
            </div>
            <p className="card-desc">
              Convert images while keeping good quality.
            </p>
            <span className="card-arrow">→</span>
          </Link>
          {/* 3 */}
          <Link href="/certificate" className="choice-card">
            <span className="card-icon">
              <RiAiGenerate2 />
            </span>
            <div>
              <p className="card-title">Generate Certificate</p>
              <p className="card-tag"></p>
            </div>
            <p className="card-desc">
              Complete name,company name and font size.{" "}
            </p>
            <span className="card-arrow">→</span>
          </Link>
        </div>
      </div>
      {/* footer */}
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
