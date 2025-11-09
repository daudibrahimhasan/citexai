'use client';

import { useState } from 'react';

export function useCitationVerify() {
  const [results, setResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkCitation = async (citation) => {
    if (!citation.trim()) return;
    setIsChecking(true);
    
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
      return resultData;
    } catch (error) {
      const errorResult = {
        status: 'error',
        message: 'Error verifying',
        score: 0,
        details: { error: error.message },
        citation: citation
      };
      setResults(errorResult);
      return errorResult;
    } finally {
      setIsChecking(false);
    }
  };

  const clearResults = () => setResults(null);

  return { results, isChecking, checkCitation, clearResults };
}
