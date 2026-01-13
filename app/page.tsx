'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCitation } from './utils/formatConverter';
import { useSession, signIn } from 'next-auth/react';
import ProfileDropdown from './components/ProfileDropdown';
import toast, { Toaster } from 'react-hot-toast';

/* ============================================================================
   CONSTANTS
   ============================================================================ */

const CONSTANTS = {
  MAX_PDF_SIZE: 10 * 1024 * 1024,
  MAX_HISTORY_ITEMS: 50,
  CITATION_PREVIEW_LENGTH: 120,
  SUPPORTED_PDF_TYPES: ['application/pdf'],
} as const;

/* ============================================================================
   TYPE DEFINITIONS
   ============================================================================ */

interface CitationDetails {
  title?: string;
  authors?: string;
  year?: string;
  journal?: string;
  doi?: string;
  error?: string;
}

interface CitationData {
  citation: string;
  verified: boolean;
  score: number;
  details?: CitationDetails;
}

interface HistoryItem extends CitationData {
  id: number;
  timestamp: string;
}

interface VerificationResult {
  status: string;
  message: string;
  score: number;
  details?: CitationDetails;
  verified: boolean;
  citation: string;
}

interface CitationSuggestion {
  suggestions?: {
    APA: string;
    MLA: string;
    CHICAGO: string;
    HARVARD?: string;
  };
  source?: string;
  metadata?: {
    title: string;
    authors: string[];
    year: string;
    journal: string;
    doi: string;
  };
}

interface UserUsage {
  usage_count: number;
  limit: number;
}

type CitationFormat = 'APA' | 'MLA' | 'CHICAGO' | 'HARVARD';

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export default function Home() {
  const { data: session } = useSession();
  const navbarRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const [citation, setCitation] = useState('');
  const [results, setResults] = useState<VerificationResult | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfCitations, setPdfCitations] = useState<string[]>([]);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<CitationSuggestion | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('APA');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  /* --------------------------------------------------------------------------
     LIFECYCLE EFFECTS
     -------------------------------------------------------------------------- */

  // Scroll restoration fix - scroll to top on mount
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('citationHistory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) =>
              typeof item === 'object' &&
              item !== null &&
              'id' in item &&
              'citation' in item
          )
        ) {
          setHistory(parsed);
        } else {
          localStorage.removeItem('citationHistory');
        }
      }
    } catch {
      localStorage.removeItem('citationHistory');
    }
  }, []);

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (!navbarRef.current) return;
      navbarRef.current.classList.toggle('scrolled', window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Fetch user usage on session change
  useEffect(() => {
    if (session?.user?.email) {
      fetchUserUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  /* --------------------------------------------------------------------------
     HELPER FUNCTIONS
     -------------------------------------------------------------------------- */

  const fetchUserUsage = useCallback(async () => {
    if (!session?.user?.email) return;

    try {
      const response = await fetch('/api/user/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user usage');
      }

      const data = await response.json();
      setUserUsage({
        usage_count: data.usage_count || 0,
        limit: data.limit || 25,
      });
    } catch {
      toast.error('Failed to fetch usage data');
    }
  }, [session?.user?.email]);

  const saveToHistory = useCallback((citationData: CitationData) => {
    setHistory((prevHistory) => {
      const newHistory = [
        {
          id: Date.now(),
          citation: citationData.citation,
          verified: citationData.verified,
          score: citationData.score,
          timestamp: new Date().toLocaleString(),
          details: citationData.details,
        },
        ...prevHistory,
      ].slice(0, CONSTANTS.MAX_HISTORY_ITEMS);

      try {
        localStorage.setItem('citationHistory', JSON.stringify(newHistory));
      } catch {
        // Storage might be full
      }

      return newHistory;
    });
  }, []);

  const copyToClipboard = useCallback(async (text: string, successMessage: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success(successMessage);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          toast.success(successMessage);
        } catch {
          toast.error('Failed to copy. Please try again.');
        }

        document.body.removeChild(textArea);
      }
    } catch {
      toast.error('Failed to copy. Please try again.');
    }
  }, []);

  /* --------------------------------------------------------------------------
     CORE FUNCTIONS
     -------------------------------------------------------------------------- */

  const checkCitation = useCallback(async () => {
    if (!citation.trim()) {
      toast.error('Please enter a citation!');
      return;
    }
    setIsChecking(true);
    setSuggestion(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citation,
          userEmail: session?.user?.email || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Verification request failed');
      }

      const data = await response.json();
      const resultData: VerificationResult = {
        status: data.status,
        message: data.message,
        score: data.score,
        details: data.details,
        verified: data.verified,
        citation,
      };
      setResults(resultData);
      saveToHistory(resultData);

      if (data.verified) {
        toast.success('Citation verified successfully!');
      } else {
        toast.error('Citation could not be verified');
      }
    } catch {
      setResults({
        status: 'error',
        message: '❌ Error verifying citation. Please try again.',
        score: 0,
        details: { error: 'Verification failed. Please try again.' },
        citation,
        verified: false,
      });
      toast.error('Error verifying citation. Please try again.');
    } finally {
      setIsChecking(false);
    }
  }, [citation, session?.user?.email, saveToHistory]);

  const fixCitation = useCallback(async () => {
    if (!citation.trim()) {
      toast.error('Please enter a citation to fix!');
      return;
    }

    setIsFixing(true);

    try {
      const response = await fetch('/api/fix-citation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citation }),
      });

      if (!response.ok) {
        throw new Error('Fix citation request failed');
      }

      const data = await response.json();

      if (data.success && data.suggestion) {
        setSuggestion(data.suggestion as CitationSuggestion);
        toast.success('AI suggestion generated!');
      } else {
        toast.error(data.error || 'Failed to fix citation');
      }
    } catch {
      toast.error('Error fixing citation. Please try again.');
    } finally {
      setIsFixing(false);
    }
  }, [citation]);

  const applySuggestion = useCallback((text: string) => {
    setCitation(text);
    setSuggestion(null);
    toast.success('Suggestion applied!');
  }, []);

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !(CONSTANTS.SUPPORTED_PDF_TYPES as readonly string[]).includes(file.type) &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      toast.error('Please upload a PDF file.');
      e.target.value = '';
      return;
    }

    if (file.size > CONSTANTS.MAX_PDF_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }

    setPdfFile(file);
    setIsUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('PDF upload failed');
      }

      const data = await response.json();

      if (data.success) {
        setPdfCitations(data.citations || []);
        toast.success(`Found ${data.citationsFound || 0} citations in PDF!`);
      } else {
        toast.error(data.error || 'Failed to process PDF');
        setPdfFile(null);
      }
    } catch {
      toast.error('Error uploading PDF. Please try again.');
      setPdfFile(null);
    } finally {
      setIsUploadingPdf(false);
      e.target.value = '';
    }
  }, []);

  const copyFormattedCitation = useCallback(
    (format: CitationFormat) => {
      if (!results || !results.details) return;

      const formatted = formatCitation(results.details, format);
      copyToClipboard(formatted, `${format} citation copied to clipboard!`);
    },
    [results, copyToClipboard]
  );

  const deleteHistoryItem = useCallback((id: number) => {
    setHistory((prevHistory) => {
      const updated = prevHistory.filter((item) => item.id !== id);
      try {
        localStorage.setItem('citationHistory', JSON.stringify(updated));
      } catch {
        // Storage error
      }
      return updated;
    });
    toast.success('Item deleted');
  }, []);

  const clearAllHistory = useCallback(() => {
    toast((t) => (
      <div className="toast-confirm">
        <p>Delete all citation history?</p>
        <div className="toast-confirm-buttons">
          <button
            onClick={() => {
              setHistory([]);
              try {
                localStorage.removeItem('citationHistory');
              } catch {
                // Storage error
              }
              toast.dismiss(t.id);
              toast.success('History cleared');
            }}
            className="toast-confirm-btn toast-confirm-btn-danger"
          >
            Delete All
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="toast-confirm-btn toast-confirm-btn-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  }, []);

  const exportHistory = useCallback(() => {
    if (history.length === 0) {
      toast.error('No history to export');
      return;
    }

    const csv = [
      ['Citation', 'Verified', 'Score', 'Timestamp'],
      ...history.map((h) => [
        h.citation.replace(/"/g, '""'),
        h.verified ? 'Yes' : 'No',
        h.score + '%',
        h.timestamp,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citation-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('History exported successfully!');
    } catch {
      toast.error('Failed to export history');
    }
  }, [history]);

  const handleCitationKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        checkCitation();
      }
    },
    [checkCitation]
  );

  const handleMobileMenuClick = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const scrollToHero = useCallback(() => {
    if (heroRef.current) {
      heroRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  /* --------------------------------------------------------------------------
     STATIC DATA
     -------------------------------------------------------------------------- */

  const faqs = [
    { q: 'How accurate is CiteXai?', a: '99.2% accuracy. We verify against 200M+ papers across CrossRef, OpenAlex, and DOI databases.' },
    { q: 'Is it really free?', a: 'Yes! Free plan includes unlimited verifications, format conversion, and 3 AI fixes/day. No credit card needed.' },
    { q: 'Can it detect fake ChatGPT citations?', a: 'Yes. Our AI detects fake papers and hallucinated DOIs with 97% accuracy.' },
    { q: 'What citation formats are supported?', a: 'APA, MLA, Chicago, Harvard, IEEE, Vancouver, and AMA. Convert instantly between any format.' },
    { q: 'How does PDF extraction work?', a: 'Upload a paper (max 10MB), we extract all citations automatically. Free: 1 PDF/day. Premium: 100 PDFs.' },
    { q: 'Do you store my data?', a: 'No. Citations are deleted after 30 days. We never sell or share your data.' },
    { q: 'Can I verify multiple citations at once?', a: 'Yes. Premium users can batch-verify up to 50 citations or upload a PDF to verify all at once.' },
    { q: "What's Premium vs Free?", a: 'Premium ($4.99/mo) adds unlimited AI fixes, 100 PDFs, full sources, priority support, and Word/LaTeX export.' },
  ];

  const spotlightItems = [
    { citation: 'Johnson, M. (2024). Quantum Computing in Medicine. Nature Physics, 20(4), 234-245.', score: 0, status: 'fake' as const, reason: 'Journal issue does not exist' },
    { citation: 'Smith, A. (2023). Deep Learning Applications. IEEE Transactions, 15(2), 112-128.', score: 100, status: 'verified' as const, reason: 'Verified via CrossRef' },
    { citation: 'Brown, L. et al. (2023). Climate Change Impact. Science, 379(6632), 567-570.', score: 100, status: 'verified' as const, reason: 'DOI confirmed' },
    { citation: 'Davis, R. (2024). AI Ethics Framework. Journal of AI Research, 45(3), 89-102.', score: 65, status: 'partial' as const, reason: 'Author mismatch detected' },
    { citation: 'Wilson, K. (2023). Blockchain Security. ACM Computing Surveys, 55(9), 1-35.', score: 100, status: 'verified' as const, reason: 'OpenAlex verified' },
    { citation: 'Taylor, J. (2024). Neural Networks Theory. arXiv:2401.12345.', score: 0, status: 'fake' as const, reason: 'arXiv ID does not exist' },
  ];

  const features = [
    {
      icon: <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
      title: 'Instant Verification',
      desc: 'Lightning-Fast Verification: AI Checks Any Citation in Under 2 Seconds Against 200M+ Global Databases',
    },
    {
      icon: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
      title: 'Revolutionary AI Fake Detector',
      desc: 'Spot ChatGPT Hallucinations and Fake References with 97% Accuracy – Before They Ruin Your Work.',
    },
    {
      icon: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
      title: 'Smart AI Citation Fixer',
      desc: 'Automatically Repair Broken or Incomplete Citations with One Click – No More Manual Edits',
    },
    {
      icon: <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
      title: 'Effortless Formatting',
      desc: 'Convert to APA, MLA, Chicago, Harvard, IEEE & More in One Click',
    },
    {
      icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
      title: 'Citation History',
      desc: 'Save all verified citations. Export to CSV. Never lose a citation again.',
    },
    {
      icon: <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
      title: 'Unmatched Global Reach',
      desc: 'Tap into 2M+ Journals and 200M+ Papers Across All Fields – The Most Comprehensive AI Database',
    },
  ];

  const universities = [
    { name: 'MIT', logo: '/uni/mit.png' },
    { name: 'Stanford', logo: '/uni/stanford.png' },
    { name: 'Harvard', logo: '/uni/harvard.png' },
    { name: 'Oxford', logo: '/uni/oxford.png' },
    { name: 'Cambridge', logo: '/uni/cambridge.png' },
    { name: 'Yale', logo: '/uni/yale.png' },
    { name: 'Princeton', logo: '/uni/princeton.png' },
    { name: 'Berkeley', logo: '/uni/berkeley.png' },
  ];

  /* --------------------------------------------------------------------------
     RENDER
     -------------------------------------------------------------------------- */

  return (
    <div className="app">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* HEADER */}
      <header>
        <nav
          ref={navbarRef}
          id="navbar"
          className="navbar"
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="container">
            <div className="navbar-content">
              <div className="navbar-brand">
                <Link href="/" className="logo" aria-label="CiteXai Home" onClick={scrollToHero}>
                  CiteXai
                </Link>
                <span className="badge-beta" aria-label="Beta version">
                  BETA
                </span>
              </div>

              <ul className="nav-menu-center" role="menubar">
                <li role="none">
                  <a href="#features" role="menuitem">
                    PRODUCT
                  </a>
                </li>
                <li role="none">
                  <Link href="/about" target="_blank" rel="noopener noreferrer" role="menuitem">
                    ABOUT US
                  </Link>
                </li>
                <li role="none">
                  <a
                    href="https://www.linkedin.com/in/daudibrahimhasan/"
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                  >
                    COMMUNITY
                  </a>
                </li>
                <li role="none">
                  <a href="#pricing" role="menuitem">
                    PRICING
                  </a>
                </li>
              </ul>

              {/* Mobile Hamburger */}
              <button
                type="button"
                className={`hamburger-btn ${mobileMenuOpen ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
                aria-expanded={mobileMenuOpen}
              >
                <span className="hamburger-line" aria-hidden="true"></span>
                <span className="hamburger-line" aria-hidden="true"></span>
                <span className="hamburger-line" aria-hidden="true"></span>
              </button>

              <div className="navbar-actions">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="btn-text"
                  aria-label={`Toggle history panel. ${history.length} items saved.`}
                  aria-pressed={showHistory}
                >
                  History ({history.length})
                </button>

                {session ? (
                  <ProfileDropdown
                    session={session}
                    userUsage={userUsage}
                    showProfileMenu={showProfileMenu}
                    setShowProfileMenu={setShowProfileMenu}
                  />
                ) : (
                  <>
                    <button
                      onClick={() => signIn('google')}
                      className="btn-secondary btn-signin"
                      type="button"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => signIn('google')}
                      className="btn-primary btn-signup"
                      type="button"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mobile-menu"
              role="menu"
              aria-label="Mobile navigation menu"
            >
              <a href="#features" onClick={handleMobileMenuClick} role="menuitem">
                PRODUCT
              </a>
              <Link href="/about" target="_blank" rel="noopener noreferrer" onClick={handleMobileMenuClick} role="menuitem">
                ABOUT US
              </Link>
              <a
                href="https://www.linkedin.com/in/daudibrahimhasan/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMobileMenuClick}
                role="menuitem"
              >
                COMMUNITY
              </a>
              <a href="#pricing" onClick={handleMobileMenuClick} role="menuitem">
                PRICING
              </a>
              {!session && (
                <div className="mobile-menu-auth">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signIn('google');
                    }}
                    className="btn-secondary btn-block"
                    type="button"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signIn('google');
                    }}
                    className="btn-primary btn-block"
                    type="button"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN CONTENT */}
      <main>
        {/* History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="history-overlay"
                onClick={() => setShowHistory(false)}
                aria-hidden="true"
              />
              <motion.aside
                initial={{ x: -420 }}
                animate={{ x: 0 }}
                exit={{ x: -420 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="history-sidebar"
                role="complementary"
                aria-label="Citation history"
              >
                <div className="history-header">
                  <h3>Citation History</h3>
                  <button
                    type="button"
                    onClick={() => setShowHistory(false)}
                    className="history-close-btn"
                    aria-label="Close history panel"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M15 5L5 15M5 5l10 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                {history.length > 0 && (
                  <div className="history-actions">
                    <button
                      type="button"
                      onClick={clearAllHistory}
                      className="btn-danger-sm"
                      aria-label="Clear all history"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={exportHistory}
                      className="btn-success-sm"
                      aria-label="Export history as CSV file"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="M14 10v2.667A1.333 1.333 0 0112.667 14H3.333A1.333 1.333 0 012 12.667V10M11.333 5.333L8 2m0 0L4.667 5.333M8 2v8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Export CSV
                    </button>
                  </div>
                )}

                {history.length === 0 ? (
                  <div className="history-empty-state">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                      <path d="M32 20v16m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p>No citation history yet</p>
                  </div>
                ) : (
                  <div className="history-list" role="list">
                    {history.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`history-card ${item.verified ? 'verified' : 'failed'}`}
                        role="listitem"
                      >
                        <div className="history-time">{item.timestamp}</div>
                        <div className="history-text">
                          {item.citation.substring(0, CONSTANTS.CITATION_PREVIEW_LENGTH)}
                          {item.citation.length > CONSTANTS.CITATION_PREVIEW_LENGTH ? '…' : ''}
                        </div>
                        <div className="history-footer">
                          <span className={`history-badge ${item.verified ? 'success' : 'error'}`}>
                            {item.score}% {item.verified ? '✓' : '✗'}
                          </span>
                          <div className="history-item-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setCitation(item.citation);
                                setShowHistory(false);
                                toast.success('Citation loaded');
                              }}
                              className="btn-text-primary"
                              aria-label="Load this citation"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHistoryItem(item.id)}
                              className="btn-text-danger"
                              aria-label={`Delete history item from ${item.timestamp}`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <section ref={heroRef} id="hero" className="hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-content">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="live-banner"
                role="status"
                aria-live="polite"
              >
                <span className="live-dot" aria-hidden="true">
                  LIVE
                </span>
                <span>847,293 Citations Checked Today</span>
                <span className="divider" aria-hidden="true">
                  •
                </span>
                <span>3,921 Fakes Caught</span>
              </motion.div>

              <motion.h1
                id="hero-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="hero-title"
              >
                STOP CITING FAKE PAPERS
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="hero-subtitle"
              >
                {"The World's First AI Citation Checker & Fixer – Verify, Detect Fakes, and Fix Instantly."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="hero-card"
              >
                <label htmlFor="citation-input" className="input-label">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M9 2a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h5zM9 2h7a2 2 0 012 2v12a2 2 0 01-2 2h-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Paste Your Citation or Upload Paper
                </label>

                <textarea
                  id="citation-input"
                  value={citation}
                  onChange={(e) => setCitation(e.target.value)}
                  onKeyDown={handleCitationKeyDown}
                  placeholder="Smith, J. (2023). The Future of AI. Journal of Technology, 15(3), 245-267. https://doi.org/10.1234/example"
                  className="textarea-main"
                  rows={7}
                  aria-describedby="citation-help"
                />
                <span id="citation-help" className="sr-only">
                  Enter your citation to verify. Press Enter to check or Shift+Enter for new line.
                </span>

                {/* PDF Uploader */}
                <div className="pdf-uploader">
                  <div className="pdf-uploader-header">
                    <div>
                      <h3 className="pdf-title">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M13 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7l-3-5z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13 2v5h3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        PDF Citation Extractor
                      </h3>
                      <p className="pdf-subtitle">Upload research paper to extract all citations</p>
                    </div>
                    <span className="badge-premium">PREMIUM</span>
                  </div>

                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfUpload}
                    className="file-input"
                    id="pdf-upload"
                    disabled={isUploadingPdf}
                    aria-label="Upload PDF file for citation extraction"
                    aria-describedby="pdf-upload-help"
                  />
                  <span id="pdf-upload-help" className="sr-only">
                    Upload a PDF file up to 10MB to extract citations
                  </span>

                  <label
                    htmlFor="pdf-upload"
                    className={`dropzone ${isUploadingPdf ? 'loading' : ''} ${pdfFile ? 'success' : ''}`}
                  >
                    {isUploadingPdf ? (
                      <span className="dropzone-content">
                        <svg
                          className="spinner"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Processing PDF...
                      </span>
                    ) : pdfFile ? (
                      <span className="dropzone-content">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {pdfFile.name} — Click to change
                      </span>
                    ) : (
                      <span className="dropzone-content">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5m0 0L7 8m5-5v12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Click to upload PDF (max 10MB)
                      </span>
                    )}
                  </label>

                  {pdfCitations.length > 0 && (
                    <div className="pdf-results" role="region" aria-label="Extracted citations">
                      <p className="pdf-results-title">Found {pdfCitations.length} citations:</p>
                      <div className="pdf-citations-list" role="list">
                        {pdfCitations.map((cit, i) => (
                          <div
                            key={i}
                            className="pdf-citation-item"
                            role="listitem"
                            onClick={() => {
                              setCitation(cit);
                              toast.success('Citation loaded');
                            }}
                          >
                            {cit.substring(0, 100)}
                            {cit.length > 100 ? '…' : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="action-buttons">
                  <motion.button
                    type="button"
                    onClick={checkCitation}
                    disabled={isChecking}
                    whileHover={{ scale: isChecking ? 1 : 1.02 }}
                    whileTap={{ scale: isChecking ? 1 : 0.98 }}
                    className="btn-primary btn-large"
                    aria-busy={isChecking}
                    aria-label={isChecking ? 'Verifying citation...' : 'Check citation'}
                  >
                    {isChecking ? (
                      <>
                        <svg
                          className="btn-spinner"
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M16.5 5L7.5 14l-4-4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Check Citation
                      </>
                    )}
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={fixCitation}
                    disabled={isFixing}
                    whileHover={{ scale: isFixing ? 1 : 1.02 }}
                    whileTap={{ scale: isFixing ? 1 : 0.98 }}
                    className="btn-secondary btn-large"
                    aria-busy={isFixing}
                    aria-label={isFixing ? 'Fixing citation...' : 'AI fix citation'}
                  >
                    {isFixing ? (
                      <>
                        <svg
                          className="btn-spinner"
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                          <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Fixing...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M15 3.5l1.5 1.5m-1.06-1.06a2.121 2.121 0 113 3L7 18.5l-4 1 1-4L15.44 3.94z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        AI Fix Citation
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Loading Skeleton */}
                {isChecking && (
                  <div className="result-skeleton" aria-label="Loading verification results" role="status">
                    <div className="skeleton-line skeleton-wide"></div>
                    <div className="skeleton-line skeleton-medium"></div>
                    <div className="skeleton-line skeleton-narrow"></div>
                  </div>
                )}

                {/* AI SUGGESTION CARD */}
                {suggestion && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="suggestion-card"
                    role="region"
                    aria-label="AI suggestion"
                  >
                    <div className="suggestion-header">
                      <p className="suggestion-title">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        AI-Corrected Citation
                      </p>
                      {suggestion.source && <span className="suggestion-badge">From {suggestion.source}</span>}
                    </div>

                    {suggestion.suggestions ? (
                      <>
                        {/* Format Tabs */}
                        <div className="citation-formats">
                          <div className="format-tabs" role="tablist" aria-label="Citation format options">
                            {(['APA', 'MLA', 'CHICAGO', 'HARVARD'] as const).map((format) => (
                              <button
                                key={format}
                                type="button"
                                role="tab"
                                aria-selected={selectedFormat === format}
                                aria-controls={`format-panel-${format.toLowerCase()}`}
                                className={`format-tab ${selectedFormat === format ? 'active' : ''}`}
                                onClick={() => setSelectedFormat(format)}
                              >
                                {format}
                              </button>
                            ))}
                          </div>

                          <div
                            className="format-content"
                            role="tabpanel"
                            id={`format-panel-${selectedFormat.toLowerCase()}`}
                            aria-labelledby={`tab-${selectedFormat.toLowerCase()}`}
                          >
                            <p className="suggestion-text">
                              {suggestion.suggestions[selectedFormat] || suggestion.suggestions.APA}
                            </p>

                            <div className="suggestion-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  const text =
                                    suggestion.suggestions?.[selectedFormat] || suggestion.suggestions?.APA;
                                  if (text) {
                                    applySuggestion(text);
                                  }
                                }}
                                className="btn-primary btn-small"
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                  <path
                                    d="M13.5 4L6 11.5l-3.5-3.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                Apply Citation
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const text =
                                    suggestion.suggestions?.[selectedFormat] || suggestion.suggestions?.APA;
                                  if (text) {
                                    copyToClipboard(text, 'Citation copied to clipboard!');
                                  }
                                }}
                                className="btn-secondary btn-small"
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                  <path
                                    d="M5 4V3a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2h-1M3 8h6a2 2 0 012 2v6a2 2 0 01-2 2H3a2 2 0 01-2-2v-6a2 2 0 012-2z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                Copy
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Metadata Display */}
                        {suggestion.metadata && (
                          <div className="suggestion-metadata">
                            <h4>Verified Details:</h4>
                            <div className="metadata-grid">
                              {suggestion.metadata.title && (
                                <div>
                                  <strong>Title:</strong>
                                  <span>{suggestion.metadata.title}</span>
                                </div>
                              )}
                              {suggestion.metadata.authors && suggestion.metadata.authors.length > 0 && (
                                <div>
                                  <strong>Authors:</strong>
                                  <span>
                                    {suggestion.metadata.authors.slice(0, 3).join(', ')}
                                    {suggestion.metadata.authors.length > 3 ? ', et al.' : ''}
                                  </span>
                                </div>
                              )}
                              {suggestion.metadata.year && (
                                <div>
                                  <strong>Year:</strong>
                                  <span>{suggestion.metadata.year}</span>
                                </div>
                              )}
                              {suggestion.metadata.journal && (
                                <div>
                                  <strong>Journal:</strong>
                                  <span>{suggestion.metadata.journal}</span>
                                </div>
                              )}
                              {suggestion.metadata.doi && suggestion.metadata.doi !== 'N/A' && (
                                <div>
                                  <strong>DOI:</strong>
                                  <a
                                    href={`https://doi.org/${suggestion.metadata.doi}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {suggestion.metadata.doi}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </motion.div>
                )}

                {/* Format Converter */}
                {results && results.verified && (
                  <div className="format-converter" role="region" aria-label="Format converter">
                    <h3 className="format-title">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M8 5H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-2m-4-6h6m0 0v6m0-6L10 15"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Format Converter
                    </h3>

                    <div className="format-buttons" role="group" aria-label="Copy citation in different formats">
                      {(['APA', 'MLA', 'CHICAGO', 'HARVARD'] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => {
                            setSelectedFormat(format);
                            copyFormattedCitation(format);
                          }}
                          className="btn-secondary btn-small"
                          aria-label={`Copy citation in ${format} format`}
                        >
                          Copy {format}
                        </button>
                      ))}
                    </div>

                    <div className="format-preview">
                      <p className="format-preview-label">Preview ({selectedFormat}):</p>
                      <p className="format-preview-text">{formatCitation(results.details, selectedFormat)}</p>
                    </div>
                  </div>
                )}

                {/* Results Card */}
                {results && !isChecking && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`result-card ${results.verified
                      ? 'verified'
                      : results.score < 20
                        ? 'error'
                        : results.score < 70
                          ? 'warning'
                          : 'verified'
                      }`}
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="result-header">
                      <div className="result-info">
                        <span className="result-emoji" aria-hidden="true">
                          {results.verified
                            ? '✓'
                            : results.score < 20
                              ? '✗'
                              : results.score < 70
                                ? '!'
                                : '✓'}
                        </span>
                        <div>
                          <div className="result-message">{results.message}</div>
                          {results.details?.error && <div className="result-error">{results.details.error}</div>}
                        </div>
                      </div>
                      <div className="result-score-box">
                        <div className="result-score" aria-label={`Health score: ${results.score} percent`}>
                          {results.score}%
                        </div>
                        <div className="result-label">Health Score</div>
                      </div>
                    </div>

                    {results.details &&
                      Object.keys(results.details).length > 0 &&
                      !results.details.error && (
                        <div className="result-details">
                          {results.details.title && (
                            <div className="detail-row">
                              <span className="detail-label">Title:</span>
                              <span className="detail-value">
                                {String(results.details.title).substring(0, CONSTANTS.CITATION_PREVIEW_LENGTH)}
                              </span>
                            </div>
                          )}
                          {results.details.authors && (
                            <div className="detail-row">
                              <span className="detail-label">Authors:</span>
                              <span className="detail-value">
                                {String(results.details.authors).substring(0, 100)}
                              </span>
                            </div>
                          )}
                          {results.details.year && (
                            <div className="detail-row">
                              <span className="detail-label">Year:</span>
                              <span className="detail-value">{results.details.year}</span>
                            </div>
                          )}
                          {results.details.journal && (
                            <div className="detail-row">
                              <span className="detail-label">Journal:</span>
                              <span className="detail-value">{results.details.journal}</span>
                            </div>
                          )}
                          {results.details.doi && (
                            <div className="detail-row">
                              <span className="detail-label">DOI:</span>
                              <span className="detail-value">
                                <a
                                  href={`https://doi.org/${results.details.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {results.details.doi}
                                </a>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* University Logos */}
        <section className="logos-section" aria-label="Trusted by universities">
          <div className="logos-container">
            <p className="logos-title">Used by professors and students of</p>
            <div className="marquee">
              <div className="marquee-track">
                {universities.map((uni, i) => (
                  <div key={i} className="marquee-item">
                    <Image
                      src={uni.logo}
                      alt={`${uni.name} logo`}
                      width={180}
                      height={70}
                      className="uni-logo"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <article id="features" className="features-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="section-header"
            >
              <h2 className="section-title">
                Why Researchers Trust
                <br />
                <span className="gradient-text">CiteXai</span>
              </h2>
              <p className="section-subtitle">
                Professional citation verification tools used by thousands of students and academics worldwide
              </p>
            </motion.div>

            <div className="features-grid">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="feature-card"
                >
                  <div className="feature-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      {feature.icon}
                    </svg>
                  </div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-desc">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </article>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="spotlight-section">
          <div className="container">
            <h2 className="section-title">CiteXai AI in Action: Instant Fake Detection</h2>
            <p className="section-subtitle">Watch as our pioneering AI cross-references against massive databases to deliver flawless results.</p>

            <div className="spotlight-stack" role="list">
              {spotlightItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`spotlight-card spotlight-${item.status}`}
                  role="listitem"
                >
                  <div className="spotlight-header">
                    <span className={`spotlight-badge badge-${item.status}`}>
                      {item.status === 'fake' ? 'FAKE' : item.status === 'verified' ? 'VERIFIED' : 'PARTIAL'}
                    </span>
                    <span className="spotlight-score">{item.score}%</span>
                  </div>
                  <p className="spotlight-citation">{item.citation}</p>
                  <p className="spotlight-reason">{item.reason}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Split Hero */}
        <section className="split-hero">
          <div className="container">
            <div className="split-hero-grid">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="split-hero-image"
              >
                <div className="image-wrapper">
                  <Image
                    src="/images/hero-image.jpg"
                    alt="Citation verification dashboard showing verified and fake citations"
                    width={800}
                    height={600}
                    className="split-image"
                    priority={false}
                    quality={75}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="split-hero-content"
              >
                <span className="split-hero-badge">AI-POWERED VERIFICATION</span>
                <h2 className="split-hero-title">
                  Never Submit a <span className="text-highlight">Fake Citation</span> Again
                </h2>
                <p className="split-hero-description">
                  {"Powered by the World's First AI Citation Guardian – 99.2% Accurate, advanced AI to cross-reference your citations against 200M+ papers. Catch hallucinated papers, broken links, and formatting errors before your professor does."}

                </p>

                <div className="split-hero-stats">
                  <div className="stat-item">
                    <div className="stat-number">99.2%</div>
                    <div className="stat-label">Accuracy Rate</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">2M+</div>
                    <div className="stat-label">Journals</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">200M+</div>
                    <div className="stat-label">Papers</div>
                  </div>
                </div>

                <a href="#hero" className="btn-primary btn-large">
                  Start Verifying Free →
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="pricing-section">
          <div className="container">
            <div className="pricing-header">
              <h2 className="pricing-main-title">Simple, Transparent Pricing</h2>
              <p className="pricing-subtitle">Choose the plan that fits your needs</p>
            </div>

            <div className="pricing-grid">
              {/* Free Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="pricing-card"
              >
                <div className="pricing-card-header">
                  <h3 className="pricing-name">Free</h3>
                  <div className="pricing-price-box">
                    <span className="pricing-amount">$0</span>
                    <span className="pricing-period">/forever</span>
                  </div>
                  <p className="pricing-desc">No credit card required</p>
                </div>

                <ul className="pricing-features" role="list">
                  {[
                    'Unlimited verifications',
                    'Format converter (APA/MLA/Chicago/Harvard)',
                    'Citation history (10)',
                    'AI citation fixer (3/day)',
                    'PDF extract (1 PDF/day)',
                  ].map((feature, idx) => (
                    <li key={idx}>
                      <svg className="feature-check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M6 10l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a href="/signup" className="btn-pricing btn-secondary">
                  Get Started Free
                </a>
              </motion.div>

              {/* Premium Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="pricing-card pricing-popular"
              >
                <div className="pricing-popular-badge">MOST POPULAR</div>

                <div className="pricing-card-header">
                  <h3 className="pricing-name">Premium</h3>
                  <div className="pricing-price-box">
                    <div className="price-crossed">
                      <span className="pricing-original">$7</span>
                    </div>
                    <div className="price-main">
                      <span className="pricing-amount">$4.99</span>
                      <span className="pricing-period">/month</span>
                    </div>
                  </div>
                </div>

                <ul className="pricing-features" role="list">
                  {[
                    { text: 'Everything in Free', premium: false },
                    { text: 'Unlimited verifications', premium: true },
                    { text: 'Unlimited Format converter', premium: true },
                    { text: 'Sources and full citation', premium: true },
                    { text: 'Unlimited AI fixes', premium: true },
                    { text: 'PDF uploads (100 total)', premium: false },
                    { text: 'Priority verification', premium: false },
                    { text: 'Export to Word/LaTeX', premium: true },
                  ].map((feature, idx) => (
                    <li key={idx}>
                      {feature.premium ? (
                        <svg className="feature-star" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path
                            d="M10 2l2.5 5.5L18 8.5l-4.5 4 1 6.5L10 16l-4.5 3 1-6.5L2 8.5l5.5-1z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg className="feature-check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                          <path
                            d="M6 10l3 3 5-6"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>

                <a href="/premium" className="btn-pricing btn-primary">
                  Upgrade to Premium
                </a>
              </motion.div>

              {/* Enterprise Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="pricing-card"
              >
                <div className="pricing-card-header">
                  <h3 className="pricing-name">Enterprise</h3>
                  <div className="pricing-price-box">
                    <span className="pricing-amount pricing-amount-custom">Custom</span>
                  </div>
                  <p className="pricing-desc">For companies and institutions</p>
                </div>

                <ul className="pricing-features" role="list">
                  {[
                    'Unlimited team members',
                    'Dedicated support',
                    'API access',
                    'Custom integrations',
                    'SSO & Admin dashboard',
                    'FERPA/GDPR compliant',
                  ].map((feature, idx) => (
                    <li key={idx}>
                      <svg className="feature-check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M6 10l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a href="mailto:daudibrahimhasan@gmail.com" className="btn-pricing btn-secondary">
                  Contact Sales
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-section" aria-labelledby="faq-title">
          <div className="container">
            <h2 id="faq-title" className="section-title">
              Frequently Asked Questions
            </h2>
            <div className="faq-list" role="list">
              {faqs.map((faq, i) => {
                const isOpen = expandedFaq === i;
                return (
                  <div key={i} className={`faq-item ${isOpen ? 'faq-open' : ''}`} role="listitem">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isOpen ? null : i)}
                      className="faq-question-btn"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${i}`}
                      id={`faq-question-${i}`}
                    >
                      <span className="faq-question-text">{faq.q}</span>
                      <svg
                        className="faq-chevron"
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.5 5L12.5 10L7.5 15"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          id={`faq-answer-${i}`}
                          className="faq-answer-wrapper"
                          role="region"
                          aria-labelledby={`faq-question-${i}`}
                        >
                          <div className="faq-answer">
                            <p>{faq.a}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-section-standalone" aria-label="Call to action">
          <Image
            src="/images/cta-bg.jpg"
            alt="Ready to Revolutionize Your Research? Join Thousands of Students and Professors on the Waitlist Today.
            © 2025 CiteXai – The Future of Academic Integrity."
            width={1920}
            height={960}
            className="cta-standalone-image"
            quality={75}
            priority={false}
            unoptimized
            sizes="100vw"
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="footer" role="contentinfo">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-brand">
                CiteX<span className="gradient-text">ai</span>
              </div>
              <p className="footer-tagline">Verify citations. Fix broken ones. Save grades. Stay honest.</p>
            </div>

            <div className="footer-col">
              <h4 className="footer-title">Product</h4>
              <ul className="footer-links">
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#how-it-works">How It Works</a>
                </li>
                <li>
                  <a href="#pricing">Pricing</a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-title">Company</h4>
              <ul className="footer-links">
                <li>
                  <Link href="/about">About Us</Link>
                </li>
                <li>
                  <a href="https://discord.gg/6fBAZ2tzfK" target="_blank" rel="noopener noreferrer">
                    Community
                  </a>
                </li>
                <li>
                  <a href="mailto:daudibrahimhasan@gmail.com">Contact</a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-title">Legal</h4>
              <ul className="footer-links">
                <li>
                  <Link href="/privacy">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/terms">Terms of Service</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>
              © {new Date().getFullYear()} CiteXai. Built by <strong>DaudX</strong> •{' '}
              <a href="mailto:daudibrahimhasan@gmail.com">daudibrahimhasan@gmail.com</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}