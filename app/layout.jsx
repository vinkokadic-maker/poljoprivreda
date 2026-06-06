import './globals.css'

export const metadata = {
  title: 'Poljoprivreda',
  description: 'Evidencija peradarstva, ratarstva i svinja',
  manifest: '/manifest.webmanifest',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2e7d32',
}

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <body>{children}</body>
    </html>
  )
}
