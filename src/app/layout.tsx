import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perks Keeper",
  description: "Track credit card offers and perks in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">{children}</body>
    </html>
  );
}
