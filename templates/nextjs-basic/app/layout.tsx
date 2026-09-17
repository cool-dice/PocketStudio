import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Новое приложение",
  description: "Создано в VibeFlow — мысли становятся приложениями",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
