import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lab Report Automation Assistant",
  description:
    "Student-facing MVP for automated lab report analysis, outlining, and report generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
