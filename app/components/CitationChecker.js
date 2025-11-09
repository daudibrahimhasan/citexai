import { motion } from 'framer-motion';

export function CitationChecker({ results, onFormatCopy }) {
  if (!results) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`max-w-3xl mt-8 p-8 rounded-xl border-2 ${
      results.verified 
        ? 'bg-green-50 border-green-300' 
        : results.score < 20 
        ? 'bg-red-50 border-red-300' 
        : 'bg-yellow-50 border-yellow-300'
    }`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className={`text-xl font-bold ${
            results.verified ? 'text-green-700' : results.score < 20 ? 'text-red-700' : 'text-yellow-700'
          }`}>
            {results.message}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-5xl font-black ${
            results.verified ? 'text-green-700' : results.score < 20 ? 'text-red-700' : 'text-yellow-700'
          }`}>
            {results.score}%
          </p>
          <p className="text-sm text-gray-600 mt-1">Confidence</p>
        </div>
      </div>

      {results.details && (
        <div className="space-y-2 text-sm border-t-2 border-gray-200 pt-4">
          {results.details.title && <p><span className="font-semibold">Title:</span> {results.details.title}</p>}
          {results.details.authors && <p><span className="font-semibold">Authors:</span> {results.details.authors}</p>}
          {results.details.year && <p><span className="font-semibold">Year:</span> {results.details.year}</p>}
          {results.details.journal && <p><span className="font-semibold">Journal:</span> {results.details.journal}</p>}
        </div>
      )}

      {results.verified && (
        <div className="mt-6 pt-6 border-t-2 border-gray-200">
          <p className="text-sm font-semibold mb-3">Export Format:</p>
          <div className="grid grid-cols-4 gap-2">
            {['APA', 'MLA', 'CHICAGO', 'HARVARD'].map(format => (
              <button 
                key={format}
                onClick={() => onFormatCopy(format, results.details)}
                className="px-3 py-2 bg-white border-2 border-gray-300 hover:border-[#565b96] text-sm font-semibold rounded-lg transition"
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
