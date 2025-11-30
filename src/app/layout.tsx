import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vista SOT Dashboard",
  description: "Review, edit, and upload SOT + invoice data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
