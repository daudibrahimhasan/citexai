export default function PrivacyPolicy() {
  return (
    <div className="legal-minimal">
      <div className="legal-wrapper">
        
        <div className="legal-title-section">
          <h1 className="legal-page-title">Privacy Policy</h1>
          <div className="legal-meta">
            <span>Effective: November 13, 2025</span>
            <span>Last Updated: November 13, 2025</span>
          </div>
        </div>

        <div className="legal-body">
          
          <p className="legal-intro-text">
            CiteXai is committed to protecting your privacy. This Privacy Policy explains how we collect, 
            use, and safeguard your information when you use our citation verification service.
          </p>

          <section className="legal-section">
            <h2 className="legal-section-heading">Information We Collect</h2>
            <ul className="legal-list">
              <li><strong>Citations:</strong> Text you paste for verification (stored temporarily for 24 hours)</li>
              <li><strong>Citation History:</strong> Stored locally in your browser (localStorage)</li>
              <li><strong>Usage Data:</strong> Analytics, performance metrics, error logs</li>
              <li><strong>Account Information:</strong> Email address if you create an account</li>
              <li><strong>Payment Information:</strong> Processed by Stripe (we never store card details)</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">How We Use Your Data</h2>
            <ul className="legal-list">
              <li>Verify citations against academic databases (CrossRef, OpenAlex, Google Books)</li>
              <li>Fix broken citations using AI (Grok by xAI)</li>
              <li>Display your verification history and statistics</li>
              <li>Improve our algorithms and service quality</li>
              <li>Send important service updates</li>
              <li>Process payments for Premium subscriptions</li>
              <li>Detect and prevent fraud or security threats</li>
            </ul>
            <span className="legal-highlight">
              We do NOT sell, rent, or share your personal data with third parties for marketing purposes.
            </span>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Data Retention</h2>
            <ul className="legal-list">
              <li><strong>Server Cache:</strong> Citations deleted after 24 hours</li>
              <li><strong>Browser Storage:</strong> You can clear history anytime</li>
              <li><strong>Account Data:</strong> Retained until you delete your account</li>
              <li><strong>Backup Logs:</strong> Deleted after 30 days</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Third-Party Services</h2>
            <ul className="legal-list">
              <li><strong>CrossRef API:</strong> Citation verification (no personal data stored)</li>
              <li><strong>OpenAlex:</strong> Academic paper search (no personal data stored)</li>
              <li><strong>Google Books API:</strong> Book verification (no personal data stored)</li>
              <li><strong>Grok AI (xAI):</strong> Citation fixing (queries not stored)</li>
              <li><strong>Stripe:</strong> Payment processing (PCI-DSS compliant)</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Your Rights (GDPR & CCPA)</h2>
            <ul className="legal-list">
              <li><strong>Access:</strong> View all personal data we have about you</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Delete your account and all associated data</li>
              <li><strong>Portability:</strong> Export your data in CSV format</li>
              <li><strong>Objection:</strong> Opt-out of analytics and tracking</li>
              <li><strong>Withdrawal:</strong> Revoke consent at any time</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Data Security</h2>
            <p>
              We implement industry-standard security measures including HTTPS/TLS encryption, secure servers, 
              regular security audits, and access controls. However, no internet transmission is 100% secure.
            </p>
          </section>

          <section className="legal-section">
            <h2 className="legal-section-heading">Contact Us</h2>
            <div className="contact-info">
              <p><strong>Privacy Officer:</strong> DaudX (Daud Ibrahim Hasan)</p>
              <p><strong>Email:</strong> <a href="mailto:privacy@citexai.com" className="legal-link">privacy@citexai.com</a></p>
              <p><strong>Developer:</strong> <a href="mailto:daudibrahimhasan@gmail.com" className="legal-link">daudibrahimhasan@gmail.com</a></p>
            </div>
          </section>

        </div>

        <div className="legal-footer-minimal">
          <p><strong>© 2025 CiteXai by DaudX. All Rights Reserved.</strong></p>
          <p>This Privacy Policy is protected by copyright.</p>
        </div>

      </div>
    </div>
  );
}
