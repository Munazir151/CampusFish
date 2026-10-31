import type { Metadata, Viewport } from "next";
import ToastProvider from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusIntel — Your academic world. One intelligence platform.",
  description:
    "CampusIntel researches official institutional sources, discovers academic opportunities, tracks changes in policies and helps students understand what applies to them.",
  applicationName: "CampusIntel",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
