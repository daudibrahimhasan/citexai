'use client';

import './globals.css';
import './components/ChatboxAdditions.css';
import { Roboto_Flex, Roboto_Mono } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';


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
   ROOT LAYOUT
   ============================================================================ */


export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Primary Meta Tags */}
        <title>CiteXai - AI-Powered Citation Verification | Stop Citing Fake Papers</title>
        <meta name="title" content="CiteXai - AI-Powered Citation Verification | Stop Citing Fake Papers" />
        <meta name="description" content="Verify citations instantly against 200M+ papers. Catch fake ChatGPT citations and broken DOIs with 99.2% accuracy. Free citation checker and formatter for APA, MLA, Chicago." />
        <meta name="keywords" content="citation verification, citation checker, fake citation detector, academic citations, APA formatter, MLA formatter, ChatGPT citations, DOI verification, research paper checker, bibliography verification" />
        <meta name="author" content="CiteXai Team" />
        <meta name="creator" content="CiteXai" />
        <meta name="publisher" content="CiteXai" />
        <meta name="category" content="education" />
        <meta name="referrer" content="origin-when-cross-origin" />
        
        {/* Open Graph / Facebook / LinkedIn */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://citexai.com" />
        <meta property="og:site_name" content="CiteXai" />
        <meta property="og:title" content="CiteXai - Stop Citing Fake Papers" />
        <meta property="og:description" content="AI-powered citation verification with 99.2% accuracy. Verify against 200M+ papers. Free forever." />
        <meta property="og:image" content="https://citexai.com/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="CiteXai Citation Verification Platform" />
        <meta property="og:image:type" content="image/jpeg" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@citexai" />
        <meta name="twitter:creator" content="@citexai" />
        <meta name="twitter:title" content="CiteXai - AI Citation Verification" />
        <meta name="twitter:description" content="Verify citations instantly. Catch fake papers. Free forever." />
        <meta name="twitter:image" content="https://citexai.com/twitter-image.jpg" />
        
        {/* Robots */}
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1" />
        
        {/* Canonical */}
        <link rel="canonical" href="https://citexai.com" />
        
        {/* Icons */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        {/* Manifest */}
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Theme */}
        <meta name="theme-color" content="#505c46" />
        <meta name="color-scheme" content="light" />
        
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
                url: 'https://citexai-beta.vercel.app',
              },
            }),
          }}
        />
      </head>
      <body className={`${robotoFlex.variable} ${robotoMono.variable}`}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
