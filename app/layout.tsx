import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Rental PS',
  description: 'Sistem Manajemen Rental PlayStation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-gray-950 text-white min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          {/* md:ml-64 untuk desktop, mobile full width */}
          <main className="flex-1 md:ml-64 p-4 md:p-6 min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
