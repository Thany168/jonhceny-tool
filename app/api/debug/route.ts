import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return NextResponse.json({ error: "NO KEY FOUND" });

  // Test the actual API
  const res = await fetch(
    "https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "social-download-all-in-one.p.rapidapi.com",
      },
      body: JSON.stringify({
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    },
  );

  const text = await res.text();
  return NextResponse.json({
    keyFound: true,
    keyPrefix: key.substring(0, 8) + "...",
    status: res.status,
    response: text.substring(0, 500),
  });
}
