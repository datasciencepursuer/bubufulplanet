import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { NotificationProvider } from "@/contexts/NotificationContext"
import { NotificationContainer } from "@/components/NotificationContainer"
import QueryProvider from "@/providers/QueryProvider"
import { DataCacheProvider } from "@/contexts/DataCacheContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Vacation Planner",
  description: "Plan your perfect vacation with day-by-day itineraries, expense tracking, and more",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <NotificationProvider>
            <DataCacheProvider>
              <main className="min-h-screen bg-background">
                {children}
              </main>
              <NotificationContainer />
            </DataCacheProvider>
          </NotificationProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
