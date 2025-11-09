import './globals.css';
import type { Metadata } from 'next';
import { Roboto_Flex, Roboto_Mono } from 'next/font/google';

/* ============================================================================
   FONT CONFIGURATION
   ============================================================================ */

const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  variable: '--font-roboto-flex',
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
});

/* ============================================================================
   SEO METADATA - ENHANCED
   ============================================================================ */

export const metadata: Metadata = {
  title: 'CiteXai - AI-Powered Citation Verification | Stop Citing Fake Papers',
  description: 'Verify citations instantly against 200M+ papers. Catch fake ChatGPT citations and broken DOIs with 99.2% accuracy. Free citation checker and formatter for APA, MLA, Chicago.',
  keywords: [
    'citation verification',
    'citation checker',
    'fake citation detector',
    'academic citations',
    'APA formatter',
    'MLA formatter',
    'ChatGPT citations',
    'DOI verification',
    'research paper checker',
    'bibliography verification'
  ],
  authors: [{ name: 'CiteXai Team' }],
  creator: 'CiteXai',
  publisher: 'CiteXai',
  
  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://citexai.com',
    siteName: 'CiteXai',
    title: 'CiteXai - Stop Citing Fake Papers',
    description: 'AI-powered citation verification with 99.2% accuracy. Verify against 200M+ papers. Free forever.',
    images: [
      {
        url: 'https://citexai.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CiteXai Citation Verification Platform',
        type: 'image/jpeg',
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    site: '@citexai',
    creator: '@citexai',
    title: 'CiteXai - AI Citation Verification',
    description: 'Verify citations instantly. Catch fake papers. Free forever.',
    images: ['https://citexai.com/twitter-image.jpg'],
  },
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Verification
  verification: {
    google: 'your-google-verification-code',
    // Add your actual verification codes when you have them
  },
  
  // Other
  category: 'education',
  applicationName: 'CiteXai',
  referrer: 'origin-when-cross-origin',
  
  // Alternate Languages (if you expand internationally)
  alternates: {
    canonical: 'https://citexai.com',
  },
  
  // Icons
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  
  // Manifest
  manifest: '/site.webmanifest',
};

/* ============================================================================
   ROOT LAYOUT
   ============================================================================ */

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data - JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'CiteXai',
              description: 'AI-powered citation verification tool that checks citations against 200M+ academic papers',
              url: 'https://citexai.com',
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Web Browser',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                ratingCount: '8472',
                bestRating: '5',
              },
              author: {
                '@type': 'Organization',
                name: 'CiteXai',
                url: 'https://citexai.com',
              },
            }),
          }}
        />
        
        {/* Additional Meta Tags */}
        <meta name="theme-color" content="#505c46" />
        <meta name="color-scheme" content="light" />
      </head>
      <body className={`${robotoFlex.variable} ${robotoMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
