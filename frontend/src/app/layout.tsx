import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tfi-wordle.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'TFI Wordle | The Movie Guessing Game for Indian Cinema',
  description: 'Guess the movie in 5 tries using hero, heroine, director, music, and producer clues across Tollywood, Bollywood, and Kollywood.',
  keywords: ['movie wordle', 'tollywood game', 'bollywood game', 'kollywood game', 'indian cinema game', 'daily movie puzzle'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'TFI Wordle',
    description: 'A fast, shareable daily movie puzzle for Indian cinema fans.',
    url: siteUrl,
    siteName: 'TFI Wordle',
    type: 'website',
    images: [
      {
        url: '/social-preview.svg',
        width: 1200,
        height: 630,
        alt: 'TFI Wordle social preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TFI Wordle',
    description: 'Guess the movie in 5 tries and share your score.',
    images: ['/social-preview.svg'],
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍿</text></svg>',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
