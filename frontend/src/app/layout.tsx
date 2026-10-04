import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heizen Kitchen | Operations",
  description: "Secure role-based access for Heizen kitchen operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
