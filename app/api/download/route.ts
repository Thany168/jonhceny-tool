import { NextRequest, NextResponse } from "next/server";

function detectPlatform(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("facebook.com") || url.includes("fb.watch"))
    return "facebook";
  if (url.includes("tiktok.com")) return "tiktok";
  return null;
}

// ─── Pick best media from the API response ────────────────────────────────────
// quality examples from API: "mp4 (720p)", "mp4 (360p)", "mp3 (128kbps)" etc.

function pickBestMedia(
  medias: { url: string; quality?: string; ext?: string; type?: string }[],
  mediaType: "video" | "audio",
  preferredQuality: string, // e.g. "720p" or "192kbps"
) {
  const pool = medias.filter((m) => m.url);

  // Separate video and audio streams
  const videoStreams = pool.filter(
    (m) =>
      m.type === "video" ||
      (m.quality && (m.quality.includes("mp4") || m.quality.includes("webm"))),
  );
  const audioStreams = pool.filter(
    (m) =>
      m.type === "audio" ||
      (m.quality &&
        (m.quality.includes("mp3") ||
          m.quality.includes("m4a") ||
          m.quality.includes("kbps"))),
  );

  const targetPool = mediaType === "audio" ? audioStreams : videoStreams;
  const fallbackPool = targetPool.length ? targetPool : pool;

  // Strip the numeric part from quality label, e.g. "720p" → "720", "192kbps" → "192"
  const preferredNum = preferredQuality.replace(/[^0-9]/g, "");

  // Try exact match first
  const exact = fallbackPool.find((m) => m.quality?.includes(preferredNum));
  if (exact) return exact;

  // Find closest resolution by numeric proximity
  const numbered = fallbackPool
    .map((m) => {
      const num = m.quality?.match(/\d+/)?.[0] ?? "0";
      return { m, num: parseInt(num) };
    })
    .filter((x) => x.num > 0)
    .sort((a, b) => {
      const target = parseInt(preferredNum) || 720;
      // Prefer closest quality that is <= requested (don't upscale), else closest above
      const aDiff = a.num <= target ? target - a.num : (a.num - target) * 2;
      const bDiff = b.num <= target ? target - b.num : (b.num - target) * 2;
      return aDiff - bDiff;
    });

  return numbered[0]?.m ?? fallbackPool[0] ?? pool[0];
}

// ─── TikWM (TikTok, free) ─────────────────────────────────────────────────────
async function tryTikWM(url: string) {
  const res = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `url=${encodeURIComponent(url)}&hd=1`,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.code !== 0 || !data.data?.play) return null;

  return {
    url: data.data.hdplay ?? data.data.play,
    filename: `tiktok_${data.data.id ?? Date.now()}.mp4`,
    picker: null,
  };
}

// ─── Social Download All In One (YouTube + Facebook + TikTok) ─────────────────
async function trySocialDownloadAllInOne(
  url: string,
  key: string,
  mediaType: "video" | "audio",
  preferredQuality: string,
) {
  const res = await fetch(
    "https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "social-download-all-in-one.p.rapidapi.com",
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();

  const medias: {
    url: string;
    quality?: string;
    ext?: string;
    type?: string;
  }[] = data?.medias ?? data?.data?.medias ?? [];
  if (!medias.length) return null;

  const best = pickBestMedia(medias, mediaType, preferredQuality);

  const title = ((data.title as string) ?? "video")
    .replace(/[^a-z0-9]/gi, "_")
    .substring(0, 60);

  const ext = best.ext ?? (mediaType === "audio" ? "mp3" : "mp4");

  return {
    url: best.url,
    filename: `${title}.${ext}`,
    picker: null, // we hide the picker — user already chose
  };
}

// ─── Cobalt fallback ──────────────────────────────────────────────────────────
async function tryCobalt(url: string, mediaType: "video" | "audio") {
  const instance = process.env.COBALT_INSTANCE;
  const apiKey = process.env.COBALT_API_KEY;
  if (!instance) return null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) headers["Authorization"] = `Api-Key ${apiKey}`;

  const res = await fetch(instance, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url,
      downloadMode: mediaType === "audio" ? "audio" : "auto",
      videoQuality: "720",
      filenameStyle: "pretty",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === "error") return null;

  return {
    url: data.url ?? null,
    filename: data.filename ?? `video.${mediaType === "audio" ? "mp3" : "mp4"}`,
    picker: null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, mediaType = "video", quality = "720p" } = body;

    if (!url || typeof url !== "string")
      return NextResponse.json({ error: "Missing URL." }, { status: 400 });

    const trimmed = url.trim();
    const platform = detectPlatform(trimmed);

    if (!platform)
      return NextResponse.json(
        { error: "Only YouTube, Facebook, and TikTok links are supported." },
        { status: 400 },
      );

    const rapidKey = process.env.RAPIDAPI_KEY;
    let result = null;

    // TikTok video: try free TikWM first
    if (platform === "tiktok" && mediaType === "video") {
      result = await tryTikWM(trimmed).catch(() => null);
    }

    // All platforms: Social Download All In One
    if (!result && rapidKey) {
      result = await trySocialDownloadAllInOne(
        trimmed,
        rapidKey,
        mediaType,
        quality,
      ).catch(() => null);
    }

    // Last resort: cobalt
    if (!result) {
      result = await tryCobalt(trimmed, mediaType).catch(() => null);
    }

    if (!result) {
      return NextResponse.json(
        {
          error: !rapidKey
            ? "RAPIDAPI_KEY is missing. Add it to .env.local."
            : "Could not download this video. Make sure it is public and try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "Server error. Please try again." },
      { status: 500 },
    );
  }
}
