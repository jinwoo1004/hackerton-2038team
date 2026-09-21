import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP } from "@/shared/config/app";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/shared/ui/Toast";
import { PwaRegister } from "@/shared/lib/PwaRegister";

export const metadata: Metadata = {
  title: {
    default: `${APP.name} — ${APP.tagline}`,
    template: `%s · ${APP.name}`,
  },
  description: APP.description,
  applicationName: APP.name,
  appleWebApp: {
    capable: true,
    title: APP.shortName,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-full bg-white font-sans text-ink-900 antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
