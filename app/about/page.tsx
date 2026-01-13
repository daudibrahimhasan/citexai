'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="legal-minimal">
      <div className="legal-wrapper">
        
        <div className="legal-title-section">
          <h1 className="legal-page-title">About CiteXai</h1>
          <p className="legal-intro-text">
            Stop Fake Citations. Save Academic Integrity.
          </p>
        </div>

        <div className="legal-body">
          
          <section className="legal-section">
            <h2 className="legal-section-heading">Our Mission</h2>
            <p>
              In an era where AI-generated content is everywhere, academic integrity is under threat. 
              Fake citations are being inserted into research papers, thesis documents, and academic 
              publications at an alarming rate.
            </p>
            <p>
              CiteXai was created to solve this problem. We provide instant verification of academic 
              citations against 200M+ real papers, helping students, researchers, and educators maintain 
              the highest standards of scholarly work.
            </p>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">How It Works</h2>
            <ul className="legal-list">
              <li><strong>Paste Citation</strong> - Enter any citation in APA, MLA, Chicago, or Harvard format</li>
              <li><strong>Instant Verification</strong> - We check against CrossRef, OpenAlex, and Google Books</li>
              <li><strong>Get Results</strong> - See verification status and full paper metadata in seconds</li>
              <li><strong>AI Fix</strong> - Broken citation? Our AI corrects it automatically using Grok</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Technology Stack</h2>
            <ul className="legal-list">
              <li><strong>Frontend:</strong> Next.js 14, React 18, TypeScript, Tailwind CSS</li>
              <li><strong>Backend:</strong> Next.js API Routes, Server Components</li>
              <li><strong>Databases:</strong> CrossRef (150M papers), OpenAlex (250M), Google Books (40M)</li>
              <li><strong>AI:</strong> Grok (xAI) for intelligent citation fixing</li>
              <li><strong>Accuracy:</strong> 99.2% verification rate</li>
              <li><strong>Speed:</strong> Results in under 2 seconds</li>
            </ul>
          </section>

          <div className="copyright-box">
            <p className="copyright-title">Copyright & Developer</p>
            <p>
              <strong>CiteXai</strong> is designed, developed, and owned by <strong>DaudX (Daud Ibrahim Hasan)</strong>.
            </p>
            <p>
              All source code, design concepts, algorithms, UI/UX elements, branding, and intellectual property 
              are the exclusive property of DaudX.
            </p>
            <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#fbbf24' }}>
              © 2025 DaudX. All Rights Reserved. Unauthorized reproduction, distribution, or modification 
              of any part of this application is strictly prohibited.
            </p>
          </div>

          <section className="legal-section">
            <h2 className="legal-section-heading">Company Association</h2>
            <p style={{ textAlign: 'center' }}>
              CiteXai is proudly associated with <strong>NEXASITY.AI</strong>, a technology company focused on 
              AI-powered solutions for education and research.
            </p>
          </section>

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <a href="mailto:daudibrahimhasan@gmail.com" className="btn-legal-modern">Contact Developer</a>
            <a href="https://www.linkedin.com/in/daudibrahimhasan/" target="_blank" rel="noopener noreferrer" className="btn-legal-outline">LinkedIn Profile</a>
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link href="/" className="btn-legal-modern">Try CiteXai Now →</Link>
          </div>

        </div>

        <div className="legal-footer-minimal">
          <p><strong>© 2025 CiteXai by DaudX. All Rights Reserved.</strong></p>
          <p>Powered by NEXASITY.AI • Unauthorized use prohibited</p>
        </div>

      </div>
    </div>
  );
}