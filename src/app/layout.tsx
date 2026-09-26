import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/app/providers";
import { LANDING_META_DESCRIPTION } from "@/lib/landing-copy";
import { THEME_STORAGE_KEY } from "@/lib/theme-pref";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Guest `/` is the public landing — do not set robots.index false here.
// Authenticated `/w/*` uses appRouteMetadata from `src/app/w/layout.tsx`.
export const metadata: Metadata = {
  title: "PocketStudio — киностудия от А до Я",
  description: LANDING_META_DESCRIPTION,
  keywords: ["PocketStudio", "киностудия", "ИИ", "сценарий", "раскадровка", "озвучка", "монтаж", "фильм"],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "PocketStudio",
    description: "Замысел → фильм → выпуск",
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
          storageKey={THEME_STORAGE_KEY}
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
