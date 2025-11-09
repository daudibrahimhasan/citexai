import { motion } from 'framer-motion';

export function Universities() {
  const universities = [
    { name: 'Harvard', country: 'USA' },
    { name: 'MIT', country: 'USA' },
    { name: 'Stanford', country: 'USA' },
    { name: 'Yale', country: 'USA' },
    { name: 'Princeton', country: 'USA' },
    { name: 'Columbia', country: 'USA' },
    { name: 'Penn', country: 'USA' },
    { name: 'Dartmouth', country: 'USA' },
    { name: 'Oxford', country: 'UK' },
    { name: 'Cambridge', country: 'UK' },
    { name: 'LSE', country: 'UK' },
    { name: 'Imperial', country: 'UK' },
    { name: 'Toronto', country: 'Canada' },
    { name: 'UBC', country: 'Canada' },
    { name: 'Melbourne', country: 'Australia' },
    { name: 'ANU', country: 'Australia' },
    { name: 'Tokyo', country: 'Japan' },
    { name: 'Kyoto', country: 'Japan' },
    { name: 'Tsinghua', country: 'China' },
    { name: 'Peking', country: 'China' },
    { name: 'ETH Zurich', country: 'Switzerland' },
    { name: 'LMU', country: 'Germany' }
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl font-bold mb-4">Trusted by Leading Universities</h2>
        <p className="text-gray-600 text-lg mb-12 max-w-3xl">
          Professors and students from Ivy Leagues and top universities across USA, UK, Canada, Australia, Japan, China & Germany use CiteXai daily.
        </p>
        
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {universities.map((uni, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-[#565b96] hover:shadow-md transition text-center"
            >
              <p className="font-semibold text-sm">{uni.name}</p>
              <p className="text-xs text-gray-500 mt-1">{uni.country}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
