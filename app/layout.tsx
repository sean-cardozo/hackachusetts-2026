import type { Metadata } from "next";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { AppStateProvider } from "@/components/AppState";
import AskPanel from "@/components/AskPanel";
import { getAskContext, getFeedStatus } from "@/lib/data";

const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const body = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "PharmaPool",
  description: "Collective purchasing for independent pharmacies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const feeds = getFeedStatus();
  const askContext = getAskContext();
  const status = feeds.every((f) => f.status === "live") ? "live" : "cached";
  const nadacDate = feeds.find((f) => f.feed === "nadac")?.effectiveDate ?? undefined;
  const shortagesDate = feeds.find((f) => f.feed === "shortages")?.effectiveDate ?? undefined;
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col font-body">
        <ToastProvider>
          <Header status={status} nadacDate={nadacDate} shortagesDate={shortagesDate} />
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-8">
            <AppStateProvider>{children}</AppStateProvider>
          </main>
          <AskPanel context={askContext} />
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
