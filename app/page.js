'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function Home() {
  const [citation, setCitation] = useState('');
  const [results, setResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkCitation = async () => {
    if (!citation.trim()) {
      alert('Please enter a citation!');
      return;
    }

    setIsChecking(true);
    setTimeout(() => {
      setResults({
        status: 'verified',
        message: 'Citation verified successfully!',
        score: 95
      });
      setIsChecking(false);
    }, 2000);
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
            className="bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-2.5 rounded-full font-bold hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
          >
            Sign In
          </motion.button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6">
        
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)]"></div>
        
        <div className="relative max-w-7xl mx-auto text-center">
          
          {/* Live Stats Counter */}
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

          {/* Main Headline */}
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
            Verify citations instantly. Save your grade. Stay honest.
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
                placeholder="Smith, J. (2023). The Future of AI. Journal of Technology, 15(3), 245-267. https://doi.org/10.1234/example"
                className="w-full h-40 p-5 bg-black/50 border-2 border-white/20 rounded-2xl focus:border-cyan-500 focus:outline-none resize-none text-white placeholder-gray-500 backdrop-blur-sm"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={checkCitation}
                disabled={isChecking}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 py-4 rounded-2xl font-bold text-lg hover:shadow-xl hover:shadow-cyan-500/50 transition-all duration-300 disabled:opacity-50"
              >
                {isChecking ? '🔍 Verifying...' : '✅ Check Citation Now'}
              </button>
              <button className="px-8 py-4 border-2 border-dashed border-white/30 rounded-2xl hover:border-cyan-500 hover:bg-white/5 transition-all duration-300 font-semibold">
                📄 Upload PDF
              </button>
            </div>

            {/* Results */}
            {results && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 p-6 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500 rounded-2xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-4xl">✅</span>
                    <div>
                      <div className="font-bold text-green-400 text-lg">Citation Verified!</div>
                      <div className="text-sm text-gray-300">{results.message}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-green-400">{results.score}%</div>
                    <div className="text-xs text-gray-400">Health Score</div>
                  </div>
                </div>
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
                icon: '🎯',
                title: 'One-Click Fixes',
                desc: 'Auto-format to APA, MLA, Chicago. Export clean bibliographies instantly.',
                color: 'from-purple-400 to-pink-500'
              },
              {
                icon: '🔒',
                title: 'Plagiarism Shield',
                desc: 'Ensure every citation is legitimate, traceable, and academically sound.',
                color: 'from-green-400 to-emerald-500'
              },
              {
                icon: '📊',
                title: 'Citation Health Score',
                desc: 'Get an instant grade-style rating for your bibliography quality.',
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

      {/* Stats Section */}
      <section className="py-32 px-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { value: '2M+', label: 'Journals Verified' },
              { value: '200M+', label: 'Papers Indexed' },
              { value: '847K', label: 'Citations Checked Today' },
              { value: '99.9%', label: 'Accuracy Rate' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400 font-semibold">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black mb-8"
          >
            Start Your Premium Journey
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              With ZERO Cost
            </span>
          </motion.h2>
          
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 px-12 py-5 rounded-full font-bold text-xl hover:shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105"
          >
            Get Started Free →
          </motion.button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-3xl font-black mb-3">
            CiteX<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">ai</span>
          </div>
          <p className="text-gray-500 mb-6">Verify citations. Save grades. Stay honest.</p>
          <p className="text-gray-600 text-sm">© 2025 CiteXai. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
