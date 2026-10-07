import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Pillar Men | Monsters & Memories Camp Mule & Courier Service",
  description: "Monsters and Memories camp trade service. Stay at your camp, our couriers come to you and buy your loot on the spot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
        <Suspense fallback={<div className="h-16 bg-zinc-950 border-b border-zinc-800" />}>
          <Navbar />
        </Suspense>
        <div className="flex-1">
          {children}
        </div>
        <footer className="border-t border-zinc-900 bg-zinc-950/80 py-6 text-center text-xs text-zinc-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 The Pillar Men • Monsters &amp; Memories Camp Courier Service</span>
            <span className="text-[11px] text-zinc-600">Platinum (pp) • Gold (gp) • Silver (sp) • Copper (cp)</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
