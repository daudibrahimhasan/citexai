// ============================================================================
// CITEXAI - CITATION VERIFICATION API (COMPLETE & WORKING)
// ============================================================================

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseCitation(citation) {
  const parsed = {
    author: null, year: null, title: null, journal: null,
    doi: null, url: null, isbn: null, format: null
  };

  const doiMatch = citation.match(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i);
  if (doiMatch) parsed.doi = doiMatch[1];

  const urlMatch = citation.match(/https?:\/\/[^\s,)]+/i);
  if (urlMatch) parsed.url = urlMatch[0];

  const isbnMatch = citation.match(/ISBN[:\s]*([\d-]{10,17})/i);
  if (isbnMatch) parsed.isbn = isbnMatch[1].replace(/[-\s]/g, '');

  const yearMatch = citation.match(/\((\d{4})\)/) || 
                    citation.match(/,\s*(\d{4})[,.\s]/) ||
                    citation.match(/\b(19\d{2}|20[0-2]\d)\b/);
  if (yearMatch) parsed.year = parseInt(yearMatch[1]);

  let authorMatch = citation.match(/^([A-Z][a-z]+(?:,\s*[A-Z]\.?(?:\s*[A-Z]\.?)?)?)/);
  if (!authorMatch) {
    authorMatch = citation.match(/^([A-Z][a-z]+(?:\s+et\s+al\.?)?)/);
  }
  if (!authorMatch) {
    authorMatch = citation.match(/^([^(]+?)(?=\s*\(?\d{4}\)?)/);
  }
  if (authorMatch) {
    parsed.author = authorMatch[1].trim().replace(/[,.]$/g, '');
  }

  let titleMatch = citation.match(/["']([^"']+)["']/);
  if (!titleMatch) {
    titleMatch = citation.match(/\(\d{4}\)\.\s*([^.]+?)(?:\.|,\s*(?:In|Journal|Nature|Science|Proceedings|Advances))/i);
  }
  if (!titleMatch) {
    titleMatch = citation.match(/\d{4}\D+?([A-Z][^.]+?)\.?\s*(?:Journal|Nature|Science|In|Proceedings)/i);
  }
  if (!titleMatch) {
    titleMatch = citation.match(/\d{4}\D+?([A-Z].+?)(?=\s+(?:Journal|Nature|Science|Proceedings|Advances|In))/i);
  }
  if (titleMatch) {
    parsed.title = titleMatch[1].trim().replace(/\s*\(\d+(?:st|nd|rd|th)?\s*ed\.?\)\.?$/, '');
  }

  const journalMatch = citation.match(/(?:Journal|Proceedings|In|Advances in)\s+([^,\d]+?)(?:[,.\d]|$)/i) ||
                       citation.match(/\.\s+(Nature|Science|Cell|PNAS|IEEE)\b/i);
  if (journalMatch) parsed.journal = journalMatch[1].trim();

  const hasPublisher = citation.match(/(?:Addison-Wesley|Springer|Wiley|O'Reilly|MIT Press|Cambridge|Oxford|Pearson|McGraw-Hill)/i);
  if (hasPublisher) {
    parsed.format = 'Book (APA)';
    const publisherMatch = citation.match(/([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)*)\.?\s*$/);
    if (publisherMatch) parsed.journal = publisherMatch[1];
  } else {
    parsed.format = 'APA';
  }

  return parsed;
}

function isIncomplete(parsed) {
  const hasAuthor = parsed.author && parsed.author.length > 2;
  const hasYear = parsed.year && parsed.year > 1400;
  const hasTitle = parsed.title && parsed.title.length > 3;
  const hasDOI = parsed.doi && parsed.doi.length > 5;
  
  if (hasDOI) return false;
  
  const essentialCount = [hasAuthor, hasYear, hasTitle].filter(Boolean).length;
  return essentialCount < 2;
}

function isFake(parsed, citation) {
  if (parsed.year && parsed.year > CURRENT_YEAR + 1) return 'Future year';
  if (parsed.year && parsed.year < 1800 && !parsed.doi) return 'Suspicious year';
  
  const genericTitles = ['test', 'example', 'sample', 'demo', 'lorem ipsum'];
  if (parsed.title && genericTitles.some(g => parsed.title.toLowerCase().includes(g))) {
    if (!parsed.doi) return 'Generic title';
  }
  
  return null;
}

function isValidDOI(doi) {
  return doi && /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(doi);
}

function isValidYear(year) {
  return year && year >= 1400 && year <= CURRENT_YEAR + 1;
}

async function validateDOI(doi) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const work = data.message;
      return {
        valid: true,
        metadata: {
          title: work.title?.[0] || null,
          authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()) || [],
          year: work.published?.['date-parts']?.[0]?.[0] || null,
          journal: work['container-title']?.[0] || null,
          doi: doi
        }
      };
    }
  } catch (e) {
    console.log('DOI validation error:', e.message);
  }
  return { valid: false, metadata: null };
}

async function searchOpenAlex(parsed) {
  if (!parsed.title) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    let query = parsed.title.substring(0, 80);
    if (parsed.author) query += ` ${parsed.author.substring(0, 30)}`;
    
    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.results?.[0]) {
        const work = data.results[0];
        return {
          title: work.title,
          authors: work.authorships?.map(a => a.author.display_name) || [],
          year: work.publication_year,
          journal: work.primary_location?.source?.display_name || null,
          doi: work.doi?.replace('https://doi.org/', '') || null
        };
      }
    }
  } catch (e) {
    console.log('OpenAlex error:', e.message);
  }
  return null;
}

async function searchGoogleBooks(parsed) {
  if (!parsed.title) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    let query = parsed.title.substring(0, 80);
    if (parsed.author) query += ` ${parsed.author.substring(0, 30)}`;
    
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=2`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.items?.[0]) {
        const book = data.items[0].volumeInfo;
        return {
          title: book.title,
          authors: book.authors || [],
          year: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4)) : null,
          journal: book.publisher || 'Unknown',
          isbn: book.industryIdentifiers?.[0]?.identifier || null
        };
      }
    }
  } catch (e) {
    console.log('Google Books error:', e.message);
  }
  return null;
}

function checkConsistency(parsed, metadata) {
  if (!metadata) return 0;
  let score = 0;
  
  if (parsed.title && metadata.title) {
    const p = parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const m = metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (p.includes(m.substring(0, 15)) || m.includes(p.substring(0, 15))) {
      score += 35;
    }
  }
  
  if (parsed.author && metadata.authors?.length > 0) {
    const author = parsed.author.toLowerCase().split(/[,\s]+/)[0];
    if (metadata.authors.some(a => a.toLowerCase().includes(author))) {
      score += 35;
    }
  }
  
  if (parsed.year && metadata.year) {
    if (parsed.year === metadata.year) score += 30;
    else if (Math.abs(parsed.year - metadata.year) === 1) score += 15;
  }
  
  return score;
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request) {
  try {
    const { citation } = await request.json();
    
    if (!citation || !citation.trim()) {
      return Response.json({ 
        error: 'Citation cannot be empty' 
      }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(citation);
    if (cached && Date.now() < cached.expires) {
      return Response.json(cached.data);
    }

    const parsed = parseCitation(citation);
    console.log('Parsed citation:', parsed);
    
    let score = 0;
    let checks = [];
    let metadata = null;

    // Priority 1: DOI Validation (highest confidence)
    if (parsed.doi && isValidDOI(parsed.doi)) {
      const doiResult = await validateDOI(parsed.doi);
      
      if (doiResult.valid) {
        metadata = doiResult.metadata;
        score = 100;
        
        const result = {
          verified: true,
          score: 100,
          status: 'verified',
          message: '✅ VERIFIED - Real Citation (DOI Confirmed)',
          details: {
            format: parsed.format || 'APA',
            author: metadata.authors?.join(', ') || 'Unknown',
            year: metadata.year || parsed.year || 'Unknown',
            title: metadata.title || parsed.title || 'Unknown',
            journal: metadata.journal || parsed.journal || 'Unknown',
            doi: parsed.doi,
            checks: [
              '✅ DOI validated via CrossRef',
              '✅ Paper exists in academic database',
              '✅ Metadata retrieved successfully'
            ]
          }
        };
        
        cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
        return Response.json(result);
      }
    }
    
    // Check if incomplete
    if (isIncomplete(parsed)) {
      const result = {
        verified: false,
        score: 0,
        status: 'invalid',
        message: '❌ INVALID - Incomplete citation',
        details: {
          error: 'Could not extract essential information',
          parsed_author: parsed.author || 'Not found',
          parsed_year: parsed.year || 'Not found',
          parsed_title: parsed.title || 'Not found'
        }
      };
      cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
      return Response.json(result);
    }
    
    // Check for fake patterns
    const fakeReason = isFake(parsed, citation);
    if (fakeReason) {
      const result = {
        verified: false,
        score: 0,
        status: 'fake',
        message: '❌ FAKE - Suspicious pattern detected',
        details: { error: fakeReason }
      };
      cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
      return Response.json(result);
    }
    
    // Database search
    const [openalexResult, bookResult] = await Promise.all([
      searchOpenAlex(parsed),
      searchGoogleBooks(parsed)
    ]);
    
    const bestMatch = openalexResult || bookResult;
    
    if (bestMatch) {
      metadata = bestMatch;
      const consistency = checkConsistency(parsed, bestMatch);
      score = Math.min(consistency + 40, 100);
      
      if (consistency >= 70) {
        checks.push(`✅ Found in ${bookResult ? 'Google Books' : 'OpenAlex'}`);
      } else if (consistency >= 40) {
        checks.push('⚠️ Partial match in database');
      }
    } else {
      checks.push('❌ Not found in databases');
    }

    // Final verdict
    const finalScore = Math.min(score, 100);
    let status, message;
    
    if (finalScore >= 75) {
      status = 'verified';
      message = '✅ VERIFIED - Real Citation';
    } else if (finalScore >= 50) {
      status = 'partial';
      message = `⚠️ PARTIAL - ${finalScore}% Confidence`;
    } else if (finalScore >= 25) {
      status = 'suspicious';
      message = '⚠️ SUSPICIOUS - Verify manually';
    } else {
      status = 'fake';
      message = '❌ FAKE - Not verified';
    }

    const result = {
      verified: status === 'verified',
      score: finalScore,
      status,
      message,
      details: {
        format: parsed.format || 'APA',
        author: metadata?.authors?.join(', ') || parsed.author || 'Unknown',
        year: metadata?.year || parsed.year || 'Unknown',
        title: metadata?.title || parsed.title || 'Unknown',
        journal: metadata?.journal || parsed.journal || 'Unknown',
        doi: parsed.doi || metadata?.doi || 'N/A',
        checks
      }
    };

    cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
    return Response.json(result);

  } catch (error) {
    console.error('Verification error:', error);
    return Response.json({ 
      error: 'Server error',
      message: error.message 
    }, { status: 500 });
  }
}
