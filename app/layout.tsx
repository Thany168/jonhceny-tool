import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress & Resize by Jonhceny",
  description: "Assist for daily work",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Compress & Resize by Jonhceny",
    description: "Assist for daily work",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
