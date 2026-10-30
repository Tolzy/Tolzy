import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeSync } from "@/components/theme/use-theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Portrait Studio", template: "%s · Portrait Studio" },
  description: "Turn a photograph into an interactive 3D portrait.",
};

export const viewport: Viewport = {
  themeColor: "#0e0e10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before paint by THEME_INIT_SCRIPT; dark is the default.
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeSync />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
