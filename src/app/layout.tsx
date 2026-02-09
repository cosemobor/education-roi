import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import PageTracker from "@/components/PageTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://edu.hamindex.com'),
  title: {
    default: 'Higher Education Outcomes - College Earnings Explorer',
    template: '%s | HEO',
  },
  description:
    'Explore earnings outcomes by college major and school using College Scorecard data. Compare outcomes across 4,000+ programs.',
  openGraph: {
    title: 'Higher Education Outcomes - College Earnings Explorer',
    description:
      'Explore earnings outcomes by college major and school using College Scorecard data.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Higher Education Outcomes',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Scatter plot showing 5-Year Earnings vs Cost of Attendance across college tiers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Higher Education Outcomes - College Earnings Explorer',
    description:
      'Explore earnings outcomes by college major and school using College Scorecard data.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <PageTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
