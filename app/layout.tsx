import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "简可思达人排期工作台",
  description: "独立飞书排期表与内容测试协作工作台",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
