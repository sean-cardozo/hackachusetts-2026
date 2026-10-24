import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import { AppStateProvider } from "@/components/AppState";
import AskPanel from "@/components/AskPanel";
import { getAskContext, getFeedStatus } from "@/lib/data";

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

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
    <html lang="en" className={`${body.variable} ${mono.variable}`}>
      <body className="font-body">
        <ToastProvider>
          <Sidebar />
          <div className="flex min-h-screen flex-col md:pl-[232px]">
            <TopBar status={status} nadacDate={nadacDate} shortagesDate={shortagesDate} />
            <main className="mx-auto w-full max-w-[1280px] flex-1 px-[clamp(16px,3vw,40px)] pb-[110px] pt-[34px]">
              <AppStateProvider>{children}</AppStateProvider>
            </main>
            <Footer />
          </div>
          <AskPanel context={askContext} />
        </ToastProvider>
      </body>
    </html>
  );
}
