import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, DM_Sans, JetBrains_Mono, Newsreader, Work_Sans } from "next/font/google";
import "./globals.css";

// One typeface pairing per fictional product; the themes in globals.css pick them up.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"] });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Zernio Elements demo",
  description: "One set of embeddable social components, running inside three different products.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={[dmSans, newsreader, workSans, archivo, mono].map((f) => f.variable).join(" ")}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
