import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "which2 — Find Your Famous Face Mashup",
  description:
    "Upload a photo and find out which 2 famous faces you're a mashup of. Fun, fast, and free.",
  openGraph: {
    title: "which2 — Find Your Famous Face Mashup",
    description:
      "Upload a photo and find out which 2 famous faces you're a mashup of.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
