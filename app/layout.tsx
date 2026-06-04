import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress & Resize by Jonhceny",
  description: "Product for daily work",
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
