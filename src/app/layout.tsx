import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-ink Dashboard",
  description: "Weather and Google Calendar screen for ESP32 e-ink devices"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
