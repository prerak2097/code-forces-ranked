import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Nav } from "@/components/app/nav";
import { ThemeProvider } from "@/components/theme-provider";
import { getSettings } from "@/lib/queries";
import "./globals.css";
import "highlight.js/styles/github.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Codeforces Ranked",
  description: "Solo ranked practice for Codeforces — rated problems, honest Elo, real analytics.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = await getSettings();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Nav rating={cfg.rating} peakRating={cfg.peakRating} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
