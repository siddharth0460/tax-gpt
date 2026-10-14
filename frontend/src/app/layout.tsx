import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TaxCopilot | Indian Income Tax Calculator & Regime Planner",
    template: "%s | TaxCopilot",
  },
  description:
    "Accurately calculate Indian income tax liability under the Old Regime and New Regime, evaluate deductions under Chapter VI-A, and calculate Section 87A rebate.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  keywords: [
    "Income Tax Calculator India",
    "Old vs New Tax Regime",
    "New Tax Regime slabs",
    "80C deduction calculator",
    "HRA exemption",
    "Section 87A marginal relief",
    "FY 2025-26 FY 2026-27 tax",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline script prevents flash-of-wrong-theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tax_theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
