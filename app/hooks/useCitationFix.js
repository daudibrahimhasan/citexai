'use client';

import { useState } from 'react';

export function useCitationFix() {
  const [suggestion, setSuggestion] = useState(null);
  const [isFixing, setIsFixing] = useState(false);

  const fixCitation = async (citation) => {
    if (!citation.trim()) return;
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
        return data.suggestion;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsFixing(false);
    }
  };

  const applySuggestion = (suggestion) => {
    const result = suggestion;
    setSuggestion(null);
    return result;
  };

  const clearSuggestion = () => setSuggestion(null);

  return { suggestion, isFixing, fixCitation, applySuggestion, clearSuggestion };
}
