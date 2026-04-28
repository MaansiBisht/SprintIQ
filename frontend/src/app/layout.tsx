import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Serif_Display, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--f-jakarta',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--f-serif',
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
});

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--f-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SprintIQ — Intelligent Ticket Assignment',
  description: 'AI-powered Jira ticket assignment for engineering teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${dmSerif.variable} ${ibmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
