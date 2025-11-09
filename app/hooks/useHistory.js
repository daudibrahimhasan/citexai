'use client';

import { useState, useEffect } from 'react';

export function useHistory() {
  // Start with empty array, no localStorage access here
  const [history, setHistory] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load history ONCE after component mounts (hydration)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('citationHistory');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error parsing history:', error);
    }
    setIsHydrated(true);
  }, []); // Empty dependency = runs once after mount

  // Save to localStorage whenever history changes
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem('citationHistory', JSON.stringify(history));
    }
  }, [history, isHydrated]);

  const saveToHistory = (citationData) => {
    setHistory(prevHistory => [
      {
        id: Date.now(),
        citation: citationData.citation,
        verified: citationData.verified,
        score: citationData.score,
        timestamp: new Date().toLocaleString(),
        details: citationData.details
      },
      ...prevHistory
    ].slice(0, 50));
  };

  const deleteItem = (id) => {
    setHistory(prevHistory => prevHistory.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('citationHistory');
    }
  };

  return { history, saveToHistory, deleteItem, clearAll, isHydrated };
}
