import { motion } from 'framer-motion';

export function Suggestion({ suggestion, onApply }) {
  if (!suggestion) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mt-8 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
      <p className="text-sm text-gray-600 mb-3 font-medium">AI Suggestion:</p>
      <p className="text-base font-mono text-gray-800 mb-4 break-words">{suggestion}</p>
      <button 
        onClick={onApply}
        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition text-sm"
      >
        Apply Suggestion
      </button>
    </motion.div>
  );
}
