import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/app/providers";
import { LANDING_META_DESCRIPTION } from "@/lib/landing-copy";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PocketStudio — идея → продукт → доход",
  description: LANDING_META_DESCRIPTION,
  keywords: ["PocketStudio", "ИИ", "творческая студия", "генерация", "аудио", "видео", "деплой", "агент"],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "PocketStudio",
    description: "Идея → продукт → доход",
    siteName: "PocketStudio",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppProviders>
            {children}
            <Toaster position="top-right" closeButton />
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
