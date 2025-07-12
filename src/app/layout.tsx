
import type { Metadata } from "next";
import { Poppins, PT_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import AppLayout from "@/components/layout/app-layout";
import { AuthProvider } from "@/context/auth-context";
import { ServerProvider } from "@/context/server-context";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleMapsProvider } from "@/context/google-maps-provider";

const fontPoppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const fontPTSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

export const metadata: Metadata = {
  title: "Route Weaver",
  description: "Create and manage transportation journeys with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-body antialiased",
          fontPoppins.variable,
          fontPTSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GoogleMapsProvider>
            <ServerProvider>
              <AuthProvider>
                <AppLayout>
                  {children}
                </AppLayout>
                <Toaster />
              </AuthProvider>
            </ServerProvider>
          </GoogleMapsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
