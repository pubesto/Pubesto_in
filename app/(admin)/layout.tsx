import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"

import "./admin.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "Pubesto Admin",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.png?v=2", shortcut: "/favicon.ico?v=2", apple: "/apple-touch-icon.png?v=2" },
}

// The dashboard has its own root layout so its Tailwind theme never mixes with
// the storefront stylesheet (both define --muted, --background, etc.).
export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
