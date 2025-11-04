const cache = new Map();

// Function to check if citation format is valid
function isCitationFormatValid(citation) {
  // DOIs are always valid
  if (/10\.\d{4,}\/\S+/.test(citation)) {
    return true;
  }
  
  // For regular citations, just check basic requirements
  const hasYear = /\(\d{4}\)/.test(citation);
  const hasMinLength = citation.length > 20;
  const hasLetters = /[a-zA-Z]/.test(citation);
  
  return hasYear && hasMinLength && hasLetters;
}



// Function to detect obvious fakes
function detectFakeCitation(citation, searchResults) {
  const suspiciousPatterns = [
    /\(202[4-9]\)|2030/,
    /\d{4}\)\.?\s*[\w\s]+\.\s*$/,
    /^[A-Z]\.?\s[A-Z]\./,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(citation)) {
      return true;
    }
  }

  if (!searchResults || searchResults.length === 0) {
    return true;
  }

  return false;
}

// Function to calculate accuracy score
function calculateAccuracyScore(citation, work) {
  let score = 0;
  
  const yearMatch = citation.match(/\((\d{4})\)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  
  const authorMatch = citation.match(/^([^(]+)\./);
  const author = authorMatch ? authorMatch[1].trim().split(',')[0] : null;

  // Year match
  if (year && work.publication_year === year) {
    score += 35;
  } else if (year && Math.abs(work.publication_year - year) <= 1) {
    score += 20;
  } else if (year) {
    score += 5;
  }

  // Author match
  if (author && work.authors) {
    const authorList = Array.isArray(work.authors) ? work.authors.map(a => {
      if (typeof a === 'string') return a.split(' ')[0];
      return a.name ? a.name.split(' ')[0] : '';
    }).join(' ') : '';
    
    if (authorList.includes(author)) {
      score += 40;
    } else if (authorList.includes(author.substring(0, 3))) {
      score += 20;
    }
  }

  // Title match
  const titleKey = work.title || work.name || '';
  if (titleKey.length > 0) {
    score += 25;
  } else {
    score += 15;
  }

  return Math.min(score, 95);
}

// SEMANTIC SCHOLAR SEARCH
async function searchSemanticScholar(title, author) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let query = title.substring(0, 100);
    if (author) query += ` ${author}`;

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,venue,doi&limit=5`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        return data.data.map(paper => ({
          source: 'semanticscholar',
          title: paper.title,
          authors: paper.authors ? paper.authors.map(a => ({ name: a.name })) : [],
          publication_year: paper.year,
          journal: paper.venue,
          doi: paper.doi
        }));
      }
    }
  } catch (error) {
    console.log('Semantic Scholar search failed:', error.message);
  }
  return [];
}

// CORE API SEARCH
async function searchCORE(title, author) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let query = title.substring(0, 80);
    if (author) query += ` ${author}`;

    const response = await fetch(
      `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=5`,
      { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results.map(paper => ({
          source: 'core',
          title: paper.title,
          authors: paper.authors ? paper.authors.map(a => ({ name: typeof a === 'string' ? a : a.name })) : [],
          publication_year: paper.yearPublished || paper.datePublished?.substring(0, 4),
          journal: paper.source?.title,
          doi: paper.doi
        }));
      }
    }
  } catch (error) {
    console.log('CORE API search failed:', error.message);
  }
  return [];
}

// CROSSREF SEARCH
async function searchCrossRef(doi) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const work = data.message;

      return [{
        source: 'crossref',
        title: work.title ? work.title[0] : 'Unknown',
        authors: work.author ? work.author.map(a => ({ name: `${a.given} ${a.family}` })) : [],
        publication_year: work.published ? work.published['date-parts'][0][0] : 'Unknown',
        journal: work['container-title'] ? work['container-title'][0] : 'Unknown',
        doi: doi
      }];
    }
  } catch (error) {
    console.log('CrossRef search failed:', error.message);
  }
  return [];
}

// OPENALEX SEARCH
async function searchOpenAlex(title) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(title.substring(0, 100))}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results.slice(0, 5).map(work => ({
          source: 'openalex',
          title: work.title,
          authors: work.authorships ? work.authorships.map(a => ({ name: a.author.display_name })) : [],
          publication_year: work.publication_year,
          journal: work['host_venue'] ? work['host_venue'].display_name : 'Unknown',
          doi: work.doi ? work.doi.replace('https://doi.org/', '') : null
        }));
      }
    }
  } catch (error) {
    console.log('OpenAlex search failed:', error.message);
  }
  return [];
}

export async function POST(request) {
  try {
    const { citation } = await request.json();

    if (!citation || citation.trim().length === 0) {
      return Response.json({ error: 'Citation cannot be empty' }, { status: 400 });
    }

    // Check cache first
    if (cache.has(citation)) {
      return Response.json(cache.get(citation));
    }

    // Validate citation format
    if (!isCitationFormatValid(citation)) {
      const result = {
        verified: false,
        score: 0,
        status: 'fake',
        message: '❌ FAKE CITATION - Invalid format',
        details: { error: 'Citation does not follow academic format' }
      };
      cache.set(citation, result);
      return Response.json(result);
    }

    // Extract components
    const doiMatch = citation.match(/10\.\d{4,}\/\S+/);
    const doi = doiMatch ? doiMatch[0] : null;

    const yearMatch = citation.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    const authorMatch = citation.match(/^([^(]+)\./);
    const author = authorMatch ? authorMatch[1].trim() : null;

    const titleMatch = citation.match(/["']([^"']+)["']/) || citation.match(/\)\s*(.+?)\.\s*(Journal|Nature|Science|Rev)/);
    const title = titleMatch ? titleMatch[1] || titleMatch[0] : null;

    let allResults = [];

    // 1. Try DOI first (CrossRef)
    if (doi) {
      const crossrefResults = await searchCrossRef(doi);
      if (crossrefResults.length > 0) {
        const result = {
          verified: true,
          score: 98,
          status: 'verified',
          message: '✅ VERIFIED - Real Citation (CrossRef)',
          details: {
            title: crossrefResults[0].title,
            authors: crossrefResults[0].authors.map(a => a.name).join(', '),
            year: crossrefResults[0].publication_year,
            journal: crossrefResults[0].journal,
            doi: doi,
            source: 'CrossRef'
          }
        };
        cache.set(citation, result);
        return Response.json(result);
      }
    }

    // 2. Search all APIs in parallel
    const [semanticResults, coreResults, openalexResults] = await Promise.all([
      title ? searchSemanticScholar(title, author, year) : [],
      title ? searchCORE(title, author) : [],
      title ? searchOpenAlex(title) : []
    ]);

    allResults = [...semanticResults, ...coreResults, ...openalexResults];

    // 3. Find best match
    if (allResults.length > 0) {
      let bestMatch = null;
      let bestScore = 0;

      for (const work of allResults) {
        const matchScore = calculateAccuracyScore(citation, {
          ...work,
          authors: work.authors
        });

        if (matchScore > bestScore) {
          bestScore = matchScore;
          bestMatch = work;
        }
      }

      // Verified
      if (bestMatch && bestScore >= 65) {
        const result = {
          verified: true,
          score: bestScore,
          status: 'verified',
          message: `✅ VERIFIED - Real Citation (${bestMatch.source})`,
          details: {
            title: bestMatch.title,
            authors: bestMatch.authors.map(a => a.name).join(', '),
            year: bestMatch.publication_year,
            journal: bestMatch.journal,
            doi: bestMatch.doi || 'N/A',
            source: bestMatch.source.toUpperCase()
          }
        };

        cache.set(citation, result);
        return Response.json(result);
      }
      // Partial match
      else if (bestMatch && bestScore >= 40) {
        const result = {
          verified: false,
          score: bestScore,
          status: 'partial',
          message: `⚠️ PARTIAL MATCH - ${bestScore}% Confidence`,
          details: {
            title: bestMatch.title,
            authors: bestMatch.authors.map(a => a.name).join(', '),
            year: bestMatch.publication_year,
            journal: bestMatch.journal,
            doi: bestMatch.doi || 'N/A',
            source: bestMatch.source.toUpperCase(),
            note: 'Citation details may not match exactly. Verify with original source.'
          }
        };

        cache.set(citation, result);
        return Response.json(result);
      }
    }

    // 4. Check if definitely fake
    const isFake = detectFakeCitation(citation, allResults);

    if (isFake) {
      const result = {
        verified: false,
        score: 0,
        status: 'fake',
        message: '❌ FAKE CITATION - Not Found',
        details: { 
          error: 'This citation does not exist in any academic database (CrossRef, OpenAlex, Semantic Scholar, CORE)',
          source: 'Multiple databases'
        }
      };

      cache.set(citation, result);
      return Response.json(result);
    }

    // Default: not verified
    const result = {
      verified: false,
      score: 15,
      status: 'not_found',
      message: '❌ NOT VERIFIED - Possibly Fake',
      details: { error: 'Citation not found. Verify manually or provide DOI.' }
    };

    cache.set(citation, result);
    return Response.json(result);

  } catch (error) {
    return Response.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
