import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Migrate from "./migrate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TimeShield",
  description: "次にやる一手を即提示するフォーカス用ミニマムUI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Migrate />
        <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-4 text-sm font-semibold text-zinc-700">
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/focus">
              フォーカス
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/timeline">
              タイムライン
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/tasks">
              タスク
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/blocks">
              ブロック
            </Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/settings">
              設定
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
