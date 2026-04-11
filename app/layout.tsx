import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Duskgo — AI Travel Search",
  description: "Describe your trip in plain English. Get real hotels instantly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
