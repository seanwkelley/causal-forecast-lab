import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed, Newsreader } from "next/font/google";
import Link from "next/link";
import { NavBar } from "@/components/nav-bar";
import { ApiKeyProvider } from "@/lib/api-key-context";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});
const cond = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-cond",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Causal Forecast Lab",
    template: "%s · Causal Forecast Lab",
  },
  description:
    "Explore how LLM probability forecasts shift when the factors and causal links in their own causal networks are challenged or reinforced.",
};

const themeInit = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} ${cond.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <ApiKeyProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-rule">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-3 sm:px-6">
              <p>
                Companion to <em>Probing Belief Sensitivity in LLM Forecasters</em> (Kelley &amp; Riedl, 2026).
              </p>
              <p className="flex gap-4">
                <Link href="/about" className="hover:text-ink">
                  About &amp; citation
                </Link>
                <a href="https://forecastbench.org" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                  ForecastBench
                </a>
              </p>
            </div>
          </footer>
        </ApiKeyProvider>
      </body>
    </html>
  );
}
