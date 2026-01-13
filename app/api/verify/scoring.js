function calculateMatchScore(parsed, work) {
  let score = 0;
  let details = [];
  let penalties = 0;
  
  // 1. DOI MATCHING (Priority)
  if (parsed.doi && work.doi) {
    const normalizedInput = normalizeText(parsed.doi);
    const normalizedWork = normalizeText(work.doi);
    
    if (normalizedInput === normalizedWork) {
      return 100; // Auto-verify
    } else if (!normalizedInput.includes('arxiv')) {
      penalties += 25;
      details.push('⚠️ DOI mismatch (-25)');
    }
  }
  
  // 2. AUTHOR MATCHING
  let authorMatched = false;
  if (parsed.author && work.authors?.length > 0) {
    const inputAuthor = normalizeText(parsed.author);
    const inputWords = inputAuthor.split(/\s+/).filter(w => w.length >= 3);
    
    for (let i = 0; i < Math.min(work.authors.length, 10); i++) {
      const workAuthor = normalizeText(work.authors[i]);
      if (inputWords.some(w => workAuthor.includes(w)) || workAuthor.includes(inputAuthor)) {
        authorMatched = true;
        break;
      }
    }
  }

  if (authorMatched) {
    score += 30;
    details.push('✅ Author match (+30)');
  } else if (parsed.author) {
    penalties += 40;
    details.push('❌ Author mismatch (-40)');
  }

  // 3. TITLE MATCHING
  if (parsed.title && work.title) {
    const inputTitle = normalizeText(parsed.title);
    const workTitle = normalizeText(work.title);
    
    if (inputTitle === workTitle) {
      score += 55;
      details.push('✅ Title EXACT (+55)');
    } else if (inputTitle.length >= 20 && (workTitle.includes(inputTitle) || inputTitle.includes(workTitle))) {
      score += 50;
      details.push('✅ Title substring (+50)');
    } else {
      const genericWords = ['using', 'based', 'approach', 'study', 'review', 'method', 'methods', 'towards', 'toward', 'language', 'models', 'model', 'learning', 'neural', 'network', 'networks', 'deep', 'large', 'analysis', 'artificial', 'intelligence', 'data'];
      const inputWords = inputTitle.split(/\s+/).filter(w => w.length > 3 && !genericWords.includes(w));
      const workWords = workTitle.split(/\s+/).filter(w => w.length > 3 && !genericWords.includes(w));
      
      // Generic title hardening
      const isGeneric = inputTitle.match(/^(a\s+)?(study|research|survey|analysis|investigation|impact|effect|role)\s+(on|of|into|in)/i);
      if (isGeneric && !authorMatched) {
        penalties += 60;
        details.push('❌ Generic title matching wrong author (-60)');
      }

      const matches = inputWords.filter(w => workWords.includes(w)).length;
      const minWords = Math.min(inputWords.length, workWords.length);
      const overlap = minWords > 0 ? matches / minWords : 0;

      if (overlap >= 0.7) {
        score += 40;
        details.push(`✅ Title overlap ${Math.round(overlap*100)}% (+40)`);
      } else if (overlap >= 0.4) {
        score += 20;
        details.push(`⚠️ Title overlap ${Math.round(overlap*100)}% (+20)`);
      } else {
        penalties += 20;
        details.push('❌ Title mismatch (-20)');
      }
    }
  }

  // 4. YEAR MATCHING
  if (parsed.year && work.year) {
    const diff = Math.abs(parsed.year - work.year);
    if (diff === 0) {
      score += 30;
      details.push('✅ Year exact (+30)');
    } else if (diff <= 1) {
      score += 15;
      details.push('⚠️ Year +/- 1 (+15)');
    } else {
      penalties += Math.min(50, diff * 15);
      details.push(`❌ Year mismatch (${parsed.year} vs ${work.year})`);
    }
  }

  // 5. BONUS & PUNITIVE CHECKS
  if (work.citationCount > 100) {
    score += 10;
    details.push('🔥 Highly cited (+10)');
  }
  
  if (work.journal && parsed.journal) {
    if (normalizeText(work.journal).includes(normalizeText(parsed.journal))) {
      score += 5;
      details.push('✅ Journal match (+5)');
    }
  }

  // Nuclear rejection for non-matching authors on short titles
  if (!authorMatched && parsed.title && parsed.title.length < 30) {
    penalties += 30;
  }

  return Math.max(0, Math.min(100, score - penalties));
}
