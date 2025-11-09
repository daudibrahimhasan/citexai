import { motion } from 'framer-motion';

export function Features() {
  const features = [
    { icon: '⚡', title: 'Instant Verification', desc: 'Check any citation in 2 seconds against 200M+ papers' },
    { icon: '🤖', title: 'AI Citation Fixer', desc: 'Automatically fixes broken and incomplete citations' },
    { icon: '📋', title: 'Format Converter', desc: 'Convert to APA, MLA, Chicago, Harvard instantly' },
    { icon: '📄', title: 'PDF Extractor', desc: 'Extract and verify all citations from research papers' },
    { icon: '💾', title: 'Save History', desc: 'Keep track of all verified citations forever' },
    { icon: '🌍', title: 'Global Database', desc: 'CrossRef, OpenAlex, Semantic Scholar & CORE' }
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl font-bold mb-16">Everything You Need</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-[#565b96] hover:shadow-lg transition"
            >
              <p className="text-4xl mb-4">{feature.icon}</p>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
