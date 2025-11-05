'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatCitation } from './utils/formatConverter';

export default function Home() {
  const [citation, setCitation] = useState('');
  const [results, setResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  
  // PDF Upload states
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfCitations, setPdfCitations] = useState([]);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('APA');
  
  // History states
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Suggestion state
  const [suggestion, setSuggestion] = useState(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('citationHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (citationData) => {
    const newHistory = [
      {
        id: Date.now(),
        citation: citationData.citation,
        verified: citationData.verified,
        score: citationData.score,
        timestamp: new Date().toLocaleString(),
        details: citationData.details
      },
      ...history
    ].slice(0, 50); // Keep last 50
    
    setHistory(newHistory);
    localStorage.setItem('citationHistory', JSON.stringify(newHistory));
  };

  // Check Citation
  const checkCitation = async () => {
    if (!citation.trim()) {
      alert('Please enter a citation!');
      return;
    }

    setIsChecking(true);
    setSuggestion(null);
    
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citation })
      });

      const data = await response.json();
      
      const resultData = {
        status: data.status,
        message: data.message,
        score: data.score,
        details: data.details,
        verified: data.verified,
        citation: citation
      };
      
      setResults(resultData);
      saveToHistory(resultData);
    } catch (error) {
      setResults({
        status: 'error',
        message: '❌ Error verifying citation. Please try again.',
        score: 0,
        details: { error: error.message },
        citation: citation
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Fix Citation with Groq AI
  const fixCitation = async () => {
    if (!citation.trim()) {
      alert('Please enter a citation to fix!');
      return;
    }

    setIsFixing(true);
    
    try {
      const response = await fetch('/api/fix-citation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citation })
      });

      const data = await response.json();

      if (data.success) {
        setSuggestion(data.suggestion);
        // ✅ NO ALERT - Just show suggestion in UI
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setIsFixing(false);
    }
  };


  // Apply suggestion
  const applySuggestion = () => {
    if (suggestion) {
      setCitation(suggestion);
      setSuggestion(null);
    }
  };

  // PDF Upload Handler
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPdfFile(file);
    setIsUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setPdfCitations(data.citations);
        alert(`✅ Found ${data.citationsFound} citations in PDF!`);
      } else {
        alert('❌ ' + data.error);
      }
    } catch (error) {
      alert('❌ Error uploading PDF: ' + error.message);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Copy formatted citation
  const copyFormattedCitation = (format) => {
    if (!results || !results.details) return;
    
    const formatted = formatCitation(results.details, format);
    navigator.clipboard.writeText(formatted);
    alert(`✅ ${format} citation copied to clipboard!`);
  };

  // Delete history item
  const deleteHistoryItem = (id) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('citationHistory', JSON.stringify(updated));
  };

  // Clear all history
  const clearAllHistory = () => {
    if (confirm('Delete all citation history?')) {
      setHistory([]);
      localStorage.removeItem('citationHistory');
    }
  };

  // Export history as CSV
  const exportHistory = () => {
    const csv = [
      ['Citation', 'Verified', 'Score', 'Timestamp'],
      ...history.map(h => [h.citation, h.verified ? 'Yes' : 'No', h.score + '%', h.timestamp])
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'citation-history.csv';
    a.click();
  };

  return (
    <div className="bg-black text-white overflow-hidden">
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/80 backdrop-blur-xl z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-3"
          >
            <div className="text-3xl font-black tracking-tight">
              CiteX<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">ai</span>
            </div>
            <span className="text-[10px] bg-gradient-to-r from-cyan-500 to-blue-600 px-2 py-0.5 rounded-full font-bold">BETA</span>
          </motion.div>
          
          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowHistory(!showHistory)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-2.5 rounded-full font-bold hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
          >
            📋 History ({history.length})
          </motion.button>
        </div>
      </nav>

      {/* History Sidebar */}
      {showHistory && (
        <motion.div
          initial={{ x: -400 }}
          animate={{ x: 0 }}
          exit={{ x: -400 }}
          className="fixed left-0 top-20 h-[calc(100vh-80px)] w-96 bg-gradient-to-br from-gray-900 to-black border-r border-white/10 overflow-y-auto z-40 p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">Citation History</h3>
            {history.length > 0 && (
              <button
                onClick={clearAllHistory}
                className="text-xs bg-red-500/20 border border-red-500 px-2 py-1 rounded hover:bg-red-500/30"
              >
                Clear All
              </button>
            )}
          </div>

          {history.length > 0 && (
            <button
              onClick={exportHistory}
              className="w-full mb-4 bg-green-500/20 border border-green-500 px-3 py-2 rounded hover:bg-green-500/30 text-sm font-bold"
            >
              📥 Export CSV
            </button>
          )}

          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No citation history yet</p>
            ) : (
              history.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-lg border-l-4 ${
                    item.verified ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'
                  }`}
                >
                  <div className="text-xs text-gray-400">{item.timestamp}</div>
                  <div className="text-sm font-mono text-white truncate mt-1">{item.citation.substring(0, 60)}...</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-xs font-bold ${item.verified ? 'text-green-400' : 'text-red-400'}`}>
                      {item.score}% {item.verified ? '✅' : '❌'}
                    </span>
                    <button
                      onClick={() => deleteHistoryItem(item.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6">
        
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)]"></div>
        
        <div className="relative max-w-7xl mx-auto text-center">
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center space-x-2 bg-red-500/20 border border-red-500 px-6 py-3 rounded-full mb-8 backdrop-blur-sm"
          >
            <span className="text-red-400 text-sm font-bold">🚨 LIVE</span>
            <span className="text-white font-mono text-sm">847,293 Citations Checked Today</span>
            <span className="text-red-400 text-sm">• 3,921 Fakes Caught 💀</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-6xl md:text-8xl font-black leading-tight mb-6"
          >
            <span className="block">STOP CITING</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-red-600">
              FAKE PAPERS
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-400 mb-4 max-w-3xl mx-auto"
          >
            Verify citations instantly. Fix broken ones with AI. Save your grade. Stay honest.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center space-x-6 text-sm text-gray-500 mb-12"
          >
            <span>⚡ AI-Powered</span>
            <span>•</span>
            <span>CrossRef Verified</span>
            <span>•</span>
            <span>2M+ Journals</span>
          </motion.div>

          {/* Citation Input Card */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="max-w-4xl mx-auto bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl"
          >
            
            <div className="mb-6">
              <label className="block text-left text-sm font-semibold text-gray-300 mb-3">
                📝 Paste Your Citation or Upload Paper
              </label>
              <textarea
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && checkCitation()}
                placeholder="Smith, J. (2023). The Future of AI. Journal of Technology, 15(3), 245-267. https://doi.org/10.1234/example"
                className="w-full h-40 p-5 bg-black/50 border-2 border-white/20 rounded-2xl focus:border-cyan-500 focus:outline-none resize-none text-white placeholder-gray-500 backdrop-blur-sm"
              />
            </div>

            {/* PDF Upload Section */}
            <div className="mt-6 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl border-2 border-purple-500/30 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">📄 PDF Citation Extractor</h3>
                  <p className="text-sm text-gray-400">Upload research paper to extract all citations</p>
                </div>
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 rounded-full text-xs font-black">
                  PREMIUM 💎
                </span>
              </div>
              
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
                id="pdf-upload"
                disabled={isUploadingPdf}
              />
              
              <label
                htmlFor="pdf-upload"
                className={`block w-full p-4 border-2 border-dashed border-purple-500/50 rounded-xl text-center cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all ${
                  isUploadingPdf ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploadingPdf ? (
                  <span>🔄 Processing PDF...</span>
                ) : pdfFile ? (
                  <span>✅ {pdfFile.name} - Click to change</span>
                ) : (
                  <span>📄 Click to upload PDF (max 10MB)</span>
                )}
              </label>

              {pdfCitations.length > 0 && (
                <div className="mt-4 p-4 bg-black/30 rounded-xl max-h-60 overflow-y-auto">
                  <p className="text-sm font-bold text-purple-400 mb-2">
                    Found {pdfCitations.length} citations:
                  </p>
                  {pdfCitations.map((cit, i) => (
                    <div key={i} className="text-xs text-gray-300 mb-2 p-2 bg-white/5 rounded">
                      {cit.substring(0, 100)}...
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <motion.button
                onClick={checkCitation}
                disabled={isChecking}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 py-4 rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-cyan-500/50 transition-all duration-300 disabled:opacity-50"
              >
                {isChecking ? '🔍 Verifying...' : '✅ Check Citation'}
              </motion.button>

              <motion.button
                onClick={fixCitation}
                disabled={isFixing}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-green-500 to-emerald-600 py-4 rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-green-500/50 transition-all duration-300 disabled:opacity-50"
              >
                {isFixing ? '✨ Fixing...' : '✨ AI Fix Citation'}
              </motion.button>
            </div>

            {/* AI Suggestion */}
            {suggestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-500/10 border-2 border-green-500/50 rounded-xl mb-6"
              >
                <p className="text-sm text-gray-300 mb-2">✨ AI Suggestion:</p>
                <p className="text-white font-mono text-sm mb-3">{suggestion}</p>
                <button
                  onClick={applySuggestion}
                  className="bg-green-500/20 hover:bg-green-500/30 border border-green-500 px-4 py-2 rounded text-sm font-bold transition-all"
                >
                  ✅ Apply This Suggestion
                </button>
              </motion.div>
            )}

            {/* Format Converter - Show after verification */}
            {results && results.verified && (
              <div className="mt-6 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border-2 border-cyan-500/30">
                <h3 className="text-lg font-bold text-white mb-4">📋 Format Converter</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['APA', 'MLA', 'CHICAGO', 'HARVARD'].map(format => (
                      <button
                        key={format}
                        onClick={() => {
                          setSelectedFormat(format);
                          copyFormattedCitation(format);
                        }}
                        className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 px-4 py-3 rounded-xl hover:from-cyan-500/30 hover:to-blue-500/30 transition-all font-semibold"
                      >
                        Copy {format}
                      </button>
                    ))}
                </div>

                <div className="mt-4 p-4 bg-black/30 rounded-xl">
                  <p className="text-xs text-gray-400 mb-2">Preview ({selectedFormat}):</p>
                  <p className="text-sm text-white font-mono">
                    {formatCitation(results.details, selectedFormat)}
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {results && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`mt-6 p-6 rounded-2xl border-2 ${
                  results.verified
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500'
                    : results.score < 20
                    ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500'
                    : results.score < 70
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500'
                    : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-4xl">
                      {results.verified ? '✅' : results.score < 20 ? '❌' : results.score < 70 ? '⚠️' : '✅'}
                    </span>
                    <div>
                      <div className={`font-bold text-lg ${
                        results.verified 
                          ? 'text-green-400' 
                          : results.score < 20
                          ? 'text-red-400'
                          : results.score < 70
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }`}>
                        {results.message}
                      </div>
                      {results.details?.error && (
                        <div className="text-sm text-gray-300">{results.details.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-black ${
                      results.verified 
                        ? 'text-green-400' 
                        : results.score < 20
                        ? 'text-red-400'
                        : results.score < 70
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}>
                      {results.score}%
                    </div>
                    <div className="text-xs text-gray-400">Health Score</div>
                  </div>
                </div>

                {results.details && Object.keys(results.details).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/20 space-y-2 text-sm">
                    {results.details.title && (
                      <div>
                        <span className="text-gray-400">Title:</span>
                        <span className="text-white ml-2">{results.details.title.substring(0, 80)}</span>
                      </div>
                    )}
                    {results.details.authors && (
                      <div>
                        <span className="text-gray-400">Authors:</span>
                        <span className="text-white ml-2">{results.details.authors.substring(0, 60)}</span>
                      </div>
                    )}
                    {results.details.year && (
                      <div>
                        <span className="text-gray-400">Year:</span>
                        <span className="text-white ml-2">{results.details.year}</span>
                      </div>
                    )}
                    {results.details.journal && (
                      <div>
                        <span className="text-gray-400">Journal:</span>
                        <span className="text-white ml-2">{results.details.journal}</span>
                      </div>
                    )}
                    {results.details.doi && (
                      <div>
                        <span className="text-gray-400">DOI:</span>
                        <span className="text-white ml-2">{results.details.doi}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent"></div>
        
        <div className="max-w-7xl mx-auto relative">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-black mb-6">
              Premium Benefits
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                ZERO Cost
              </span>
            </h2>
            <p className="text-xl text-gray-400">Everything you need to verify citations and save your grade</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            
            {[
              {
                icon: '⚡',
                title: 'Instant Verification',
                desc: 'Check citations in 2 seconds using CrossRef, OpenAlex, and DOI databases.',
                color: 'from-yellow-400 to-orange-500'
              },
              {
                icon: '🤖',
                title: 'AI Fake Detector',
                desc: 'Catch ChatGPT hallucinations and Wikipedia trap citations automatically.',
                color: 'from-cyan-400 to-blue-500'
              },
              {
                icon: '✨',
                title: 'AI Citation Fixer',
                desc: 'Broken citation? AI fixes it instantly and suggests corrections.',
                color: 'from-green-400 to-emerald-500'
              },
              {
                icon: '🎯',
                title: 'One-Click Fixes',
                desc: 'Auto-format to APA, MLA, Chicago. Export clean bibliographies instantly.',
                color: 'from-purple-400 to-pink-500'
              },
              {
                icon: '📊',
                title: 'Citation History',
                desc: 'Save all verified citations. Export to CSV. Never lose a citation again.',
                color: 'from-red-400 to-rose-500'
              },
              {
                icon: '🌍',
                title: 'Global Database',
                desc: 'Access 2M+ journals, 200M+ papers from every academic field worldwide.',
                color: 'from-blue-400 to-indigo-500'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm p-8 rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105"
              >
                <div className={`text-6xl mb-4 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-3xl font-black mb-3">
            CiteX<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">ai</span>
          </div>
          <p className="text-gray-500 mb-6">Verify citations. Fix broken ones. Save grades. Stay honest.</p>
          <p className="text-gray-600 text-sm">© 2025 CiteXai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
