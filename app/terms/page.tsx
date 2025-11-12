export default function TermsOfService() {
  return (
    <div className="legal-minimal">
      <div className="legal-wrapper">
        
        <div className="legal-title-section">
          <h1 className="legal-page-title">Terms of Service</h1>
          <div className="legal-meta">
            <span>Effective: November 13, 2025</span>
            <span>Last Updated: November 13, 2025</span>
          </div>
        </div>

        <div className="legal-body">
          
          <p className="legal-intro-text">
            By using CiteXai, you agree to these Terms of Service. Please read carefully before using our service.
          </p>

          <div className="copyright-box">
            <p className="copyright-title">Copyright & Intellectual Property</p>
            <p>
              CiteXai, including its name, logo, branding, source code, algorithms, UI/UX design, and all intellectual 
              property, is the exclusive property of <strong>DaudX (Daud Ibrahim Hasan)</strong>.
            </p>
            <p style={{ marginTop: '1rem', fontSize: '0.9375rem' }}>
              You MAY NOT copy, reproduce, distribute, reverse-engineer, or create derivative works based on CiteXai 
              without written permission.
            </p>
          </div>

          <section className="legal-section">
            <h2 className="legal-section-heading">Service Description</h2>
            <ul className="legal-list">
              <li>Citation verification against 200M+ academic papers</li>
              <li>AI-powered citation fixing using Grok AI</li>
              <li>Citation format conversion (APA, MLA, Chicago, Harvard, IEEE, Vancouver, AMA)</li>
              <li>PDF citation extraction (Premium only)</li>
              <li>Citation history tracking and CSV export</li>
              <li>Batch verification (Premium only)</li>
            </ul>
            <span className="legal-highlight">
              CiteXai is a research tool. Always verify critical citations independently. We are NOT responsible 
              for academic consequences from incorrect results.
            </span>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Acceptable Use</h2>
            <p><strong>You MAY:</strong></p>
            <ul className="legal-list">
              <li>Verify citations for legitimate academic purposes</li>
              <li>Use AI Fix to correct incomplete citations</li>
              <li>Export your citation history</li>
              <li>Share verification results with attribution</li>
            </ul>
            
            <p><strong>You MAY NOT:</strong></p>
            <ul className="legal-list">
              <li>Use CiteXai for plagiarism or academic dishonesty</li>
              <li>Abuse the API or exceed rate limits</li>
              <li>Copy, scrape, or reverse-engineer CiteXai</li>
              <li>Upload copyrighted PDFs without authorization</li>
              <li>Circumvent security measures</li>
              <li>Violate intellectual property rights</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Pricing</h2>
            <ul className="legal-list">
              <li><strong>Free Plan:</strong> Unlimited verifications, 3 AI fixes/day</li>
              <li><strong>Premium ($4.99/month):</strong> Unlimited AI fixes, PDF extraction, batch verification</li>
              <li><strong>7-day money-back guarantee</strong></li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Liability Disclaimer</h2>
            <span className="legal-highlight">
              USE CITEXAI AT YOUR OWN RISK. WE PROVIDE THE SERVICE "AS IS" WITHOUT WARRANTIES. 
              WE ARE NOT LIABLE FOR ACADEMIC PENALTIES OR OTHER CONSEQUENCES.
            </span>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Termination</h2>
            <p>
              We may suspend or terminate your account if you violate these Terms, infringe intellectual property, 
              or engage in dishonest practices.
            </p>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Contact</h2>
            <div className="contact-info">
              <p><strong>Legal:</strong> <a href="mailto:legal@citexai.com" className="legal-link">legal@citexai.com</a></p>
              <p><strong>Support:</strong> <a href="mailto:nexasity@gmail.com" className="legal-link">support@citexai.com</a></p>
              <p><strong>Developer:</strong> <a href="mailto:daudibrahimhasan@gmail.com" className="legal-link">daudibrahimhasan@gmail.com</a></p>
            </div>
          </section>

        </div>

        <div className="legal-footer-minimal">
          <p><strong>© 2025 CiteXai by DaudX. All Rights Reserved.</strong></p>
          <p>Powered by NEXASITY.AI • Unauthorized reproduction prohibited</p>
        </div>

      </div>
    </div>
  );
}
