import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Shiplog", template: "%s · Shiplog" },
  description: "Turn your work into a story. Shiplog turns GitHub activity into beautiful product updates.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Apply the saved workspace theme before first paint to avoid a flash.
const themeScript = `try{var s=JSON.parse(localStorage.getItem("shiplog:v1")||"null");if(s&&s.version===4&&s.appTheme)document.documentElement.dataset.theme=s.appTheme;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={GeistMono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
