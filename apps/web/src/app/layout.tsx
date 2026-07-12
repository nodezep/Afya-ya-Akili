import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: 'AKILI — Your mind matters',
    template: '%s | AKILI',
  },
  description:
    'AI-powered mental health support: chat with Akili, track your mood, journal, meditate, and book licensed therapists.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f766e' },
    { media: '(prefers-color-scheme: dark)', color: '#134e4a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Apply the stored theme before hydration to avoid a flash
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('akili.theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
        <script
          // Register the offline service worker
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
