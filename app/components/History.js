'use client';

import { motion } from 'framer-motion';

export function History({ items, onDelete }) {
  return (
    <motion.div className="fixed left-0 top-16 h-[calc(100vh-64px)] w-80 bg-white border-r border-gray-200 z-40 p-6 overflow-y-auto shadow-lg">
      <h3 className="text-xl font-semibold mb-6">Citation History</h3>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-gray-500 text-sm">No citations yet</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#565b96] transition">
              <p className="text-xs text-gray-600">{item.timestamp}</p>
              <p className="text-sm font-medium truncate mt-1">{item.citation.substring(0, 40)}</p>
              <div className="flex justify-between items-center mt-2">
                <span className={`text-xs font-bold ${item.verified ? 'text-green-600' : 'text-red-600'}`}>
                  {item.score}%
                </span>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
