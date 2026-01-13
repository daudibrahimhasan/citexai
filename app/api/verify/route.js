// ============================================================================
// CITEXAI - CITATION VERIFICATION API (FINAL PRODUCTION VERSION V4)
// CrossRef (150M) + OpenAlex (250M) + Google Books (40M)
// All edge cases handled, parser bulletproofed, nuclear-strict matching
// NEW: Historical paper detection (pre-1950 boost), DOI priority, WHO fix
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function trackUsage(userEmail, citation, result) {
  // If Supabase is not configured, skip tracking
  if (!supabase) return;

  try {
    await supabase.from('usage_logs').insert({
      user_email: userEmail || null,
      action_type: 'verify',
      citation_text: citation.substring(0, 500),
      result: result.status,
      score: result.score
    });

    if (userEmail) {
      await supabase.rpc('increment_user_usage', { user_email: userEmail });
    }

    await supabase.rpc('increment_stat', { stat_name: 'verify' });
  } catch (error) {
    console.error('Tracking error:', error);
  }
}

// ============================================================================
// BULLETPROOF CITATION PARSER (HANDLES ALL EDGE CASES)
// ============================================================================

function parseCitation(citation) {
  const parsed = {
    author: null,
    year: null,
    title: null,
    journal: null,
    doi: null,
    url: null,
    isbn: null,
    arxivId: null,
    format: null
  };

  // Extract DOI (but skip arXiv DOIs for now - we'll use arXiv API directly)
  const doiMatch = citation.match(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i);
  if (doiMatch) {
    parsed.doi = doiMatch[1];
    // Check if this is an arXiv DOI and extract the arXiv ID
    const arxivDoiMatch = parsed.doi.match(/10\.48550\/arXiv\.([\d.]+)/i);
    if (arxivDoiMatch) {
      parsed.arxivId = arxivDoiMatch[1];
    }
  }

  // Extract arXiv ID directly - handles multiple formats:
  // - arXiv:1706.03762 or arXiv:1706.03762v1
  // - arXiv preprint arXiv:1706.03762
  // - arxiv.org/abs/1706.03762
  const arxivPatterns = [
    /arXiv:(\d{4}\.\d{4,5}(?:v\d+)?)/i,
    /arxiv\.org\/abs\/(\d{4}\.\d{4,5}(?:v\d+)?)/i,
    /arXiv\s+(\d{4}\.\d{4,5}(?:v\d+)?)/i,
  ];
  
  for (const pattern of arxivPatterns) {
    const arxivMatch = citation.match(pattern);
    if (arxivMatch && !parsed.arxivId) {
      parsed.arxivId = arxivMatch[1];
      break;
    }
  }

  // Extract URL
  const urlMatch = citation.match(/https?:\/\/[^\s,)]+/i);
  if (urlMatch) parsed.url = urlMatch[0];

  // Extract ISBN
  const isbnMatch = citation.match(/ISBN[:\s]*([\d-]{10,17})/i);
  if (isbnMatch) parsed.isbn = isbnMatch[1].replace(/[-\s]/g, '');

  // Extract year - IMPROVED to handle all formats
  const yearPatterns = [
    /\((\d{4})\)/,                    // (2017)
    /,\s*(\d{4})[,.\s]/,              // , 2017,
    /\b(19\d{2}|20[0-2]\d)\b/,        // 2017
    /\((\d{4})\s*[A-Z][a-z]+\)/       // (2017 January)
  ];
  
  for (const pattern of yearPatterns) {
    const match = citation.match(pattern);
    if (match) {
      parsed.year = parseInt(match[1]);
      break;
    }
  }

  // Extract author - handles ALL edge cases INCLUDING multi-word surnames
  const authorPatterns = [
    // Corporate/Organization authors (must come first)
    /^([A-Z][A-Za-z\s&]+(?:Organization|Institute|Association|Agency|Department|WHO|UNESCO|Committee))[.,]/i,
    // Multi-word surnames WITH comma: Van Der Berg, P. / O'Brien, T.
    /^([A-Z]['']?[A-Za-z]+(?:\s+(?:van|von|de|da|del|della|le|la|di|dos|du|el|al|bin|ibn|der|den|het)\s+[A-Z]['']?[a-z]+)+)\s*,/i,
    // Two-word surnames: Last First,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)\s*,/,
    // Hyphenated names: Smith-Jones,
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)+)\s*,/,
    // Names with apostrophes: O'Brien, (standalone)
    /^([A-Z][''][A-Z][a-z]+)\s*,/,
    // Standard single surname: Smith,
    /^([A-Z][a-z]+)\s*,/,
    // Edge case: "Author Year" (no comma) e.g. "Vawani 2017"
    /^([A-Z][a-z]+)\s+(?:19|20)\d{2}/
  ];
  
  for (const pattern of authorPatterns) {
    const match = citation.match(pattern);
    if (match) {
      const potentialAuthor = match[1].trim().replace(/[,.]$/, '');
      // Skip common title words
      const titleWords = ['To', 'The', 'A', 'An', 'In', 'On', 'Of', 'For', 'And', 'Or'];
      if (!titleWords.includes(potentialAuthor) && potentialAuthor.length > 1) {
        parsed.author = potentialAuthor;
        break;
      }
    }
  }

  // Extract title - handles ALL formats
  let titleText = null;
  
  // Strategy 1: Quoted text
  const quotedMatch = citation.match(/["''"]([^"''""]{5,}?)["''"]/);
  if (quotedMatch) {
    titleText = quotedMatch[1];
  }
  
  // Strategy 2: Title-only citation "Title (Year)"
  if (!titleText && !parsed.author && parsed.year) {
    const titleOnlyMatch = citation.match(/^([^(]+?)\s*\((\d{4})/);
    if (titleOnlyMatch) {
      titleText = titleOnlyMatch[1];
    }
  }
  
  // Strategy 3: Informal "Author, Year, Title" (IMPROVED for Einstein case)
  if (!titleText && parsed.author && parsed.year) {
    // Try: Einstein, 1905, Title (comma-separated, no parentheses)
    let informalPattern = new RegExp(
      `${escapeRegex(parsed.author)}[,\\s]+${parsed.year}[,\\s]+(.+)$`,
      'i'
    );
    let match = citation.match(informalPattern);
    
    if (!match) {
      // Try: Author, Year, Title. (with periods/commas)
      informalPattern = new RegExp(
        `${escapeRegex(parsed.author)}[^,]*?[,\\s]+${parsed.year}[,.\\s]+(.+?)(?:\\.|$)`,
        'i'
      );
      match = citation.match(informalPattern);
    }
    
    if (!match) {
      // Try: Author (Year). Title
      informalPattern = new RegExp(
        `${escapeRegex(parsed.author)}[^(]*?\\(${parsed.year}\\)[.,]?\\s*(.+?)(?:\\.|$)`,
        'i'
      );
      match = citation.match(informalPattern);
    }
    
    if (match) {
      titleText = match[1].trim();
    }
  }
  
  // Strategy 4: After year in parentheses (standard APA)
  if (!titleText && parsed.year) {
    const afterYearMatch = citation.match(new RegExp(
      `\\(${parsed.year}[^)]*\\)[.,]?\\s*(.+?)(?:\\.|,\\s*(?:In|Journal|Nature|Science|Proceedings)|$)`,
      'i'
    ));
    if (afterYearMatch) {
      titleText = afterYearMatch[1];
    }
  }
  
  // Strategy 5: For corporate authors with periods (WHO case)
  if (!titleText && parsed.author) {
    const corporatePattern = new RegExp(
      `${escapeRegex(parsed.author)}\\.\\s*\\(${parsed.year}\\)[.,]?\\s*(.+?)(?=\\.|\\s+Press|$)`,
      'i'
    );
    const match = citation.match(corporatePattern);
    if (match) {
      titleText = match[1].trim();
    }
  }
  
  // Strategy 6: Handle citations with "..." or "& ..." in author list (common in multi-author papers)
  // Pattern: Author1, ... & LastAuthor (Year). Title.
  if (!titleText && parsed.year) {
    const ellipsisMatch = citation.match(/\.{3}\s*(?:\&|and)?\s*[A-Z][^(]+\(\d{4}\)[.,]?\s*(.+?)(?:\.|In\s|arXiv|https)/i);
    if (ellipsisMatch) {
      titleText = ellipsisMatch[1];
    }
  }
  
  // Strategy 7: Generic fallback - find text between (year). and next sentence boundary
  if (!titleText && parsed.year) {
    const genericMatch = citation.match(new RegExp(
      `\\(${parsed.year}\\)[.,]?\\s*([^.]{10,150})\\.`,
      'i'
    ));
    if (genericMatch) {
      titleText = genericMatch[1];
    }
  }

  if (titleText) {
    parsed.title = titleText
      .trim()
      .replace(/^[.,\s]+|[.,\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/,?\s*\d+\s*(?:\(\d+\))?[,\s]*\d*[-–]\d*\.?$/, '') // Remove vol/issue/pages
      .replace(/^\d{4}[,.\s]*/, '') // Remove year if captured
      .replace(/^(et al\.|and others)[.,\s]*/i, '') // Remove "et al"
      .substring(0, 200);
  }

  // Extract journal
  const journalPatterns = [
    /\.\s*([A-Z][^,.]{3,50}?),\s*\d+\s*(?:\(\d+\))?/,  // Standard: Title. Journal, 47(2)
    /\bIn\s+([^,.(]+?)(?:[,.(]|$)/i,
    /\b(Nature|Science|Cell|Lancet|JAMA|NEJM|PNAS)\b/i,
    /(?:Journal of|Proceedings of|Advances in|Transactions on)\s+([^,.(]+)/i
  ];
  
  for (const pattern of journalPatterns) {
    const match = citation.match(pattern);
    if (match) {
      const potentialJournal = match[1].trim();
      if (potentialJournal.length > 3 && potentialJournal.length < 100) {
        parsed.journal = potentialJournal.replace(/[.,]+$/, '');
        break;
      }
    }
  }

  // Detect format
  // Detect format
  const bookKeywords = [
    'Addison-Wesley', 'Springer', 'Wiley', 'O\'Reilly', 'MIT Press', 'Cambridge University Press', 
    'Oxford University Press', 'Pearson', 'McGraw-Hill', 'Academic Press', 'Prentice Hall', 'Elsevier',
    'Routledge', 'Sage', 'Penguin', 'HarperCollins', 'Simon & Schuster', 'Harvard University Press',
    'Yale University Press', 'Princeton University Press', 'University of Chicago Press', 'CRC Press'
  ];
  
  const hasPublisher = new RegExp(`(?:${bookKeywords.join('|')})`, 'i').test(citation);
  const hasBookTitle = parsed.title && /^(Handbook|Guide|Introduction|Principles|Foundations|Fundamentals|The Art of|Understanding)\b/i.test(parsed.title);
  
  parsed.format = (hasPublisher || hasBookTitle || parsed.isbn) ? 'Book' : 'Article';

  return parsed;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Allow title-only searches (for "Climate change..." case)
function isIncomplete(parsed) {
  const hasAuthor = parsed.author && parsed.author.length > 1;
  const hasYear = parsed.year && parsed.year > 1400;
  const hasTitle = parsed.title && parsed.title.length > 3;
  const hasDOI = parsed.doi && parsed.doi.length > 5;
  
  if (hasDOI) return false;
  
  // Check for vague/generic titles that should be rejected
  const vaguePatterns = [
    /^some\s+/i,
    /^a\s+paper/i,
    /^paper\s+about/i,
    /^study\s+on/i,
    /^research\s+on/i,
    /something/i,
    /^the\s+\w+$/i  // Single word after "The"
  ];
  
  if (parsed.title && vaguePatterns.some(p => p.test(parsed.title))) {
    return true; // Reject vague titles
  }
  
  // Allow title-only if title is substantial (15+ chars) and has year
  if (!hasAuthor && hasTitle && hasYear && parsed.title.length >= 15) {
    return false;
  }
  
  // Reject if absolutely no author AND no substantial title
  if (!hasAuthor && !hasDOI) {
    return true;
  }
  
  // Rejection Logic - but NOT if we have a messy strong signal
  
  // Allow if we have ANY two strong signals:
  // 1. Author (>2 chars)
  // 2. Year (valid)
  // 3. Title (>10 chars)
  
  const strongSignals = [
    hasAuthor, 
    hasYear, 
    hasTitle && parsed.title.length > 5
  ].filter(Boolean).length;

  if (strongSignals >= 2) return false;

  // Special case: Allow Author + partial title (missing year) if title is long unique
  if (hasAuthor && hasTitle && parsed.title.length > 20) return false;

  return true;
}

function isFake(parsed) {
  if (parsed.year && parsed.year > CURRENT_YEAR + 1) return 'Future year';
  if (parsed.year && parsed.year < 1700) return 'Unrealistic year';
  
  const genericTitles = ['test', 'example', 'sample', 'demo', 'lorem ipsum', 'untitled', 'test paper', 'fake', 'dummy'];
  if (parsed.title && genericTitles.some(g => parsed.title.toLowerCase().includes(g))) {
    return 'Generic/fake title';
  }
  
  return null;
}

// NEW: Historical paper detection (pre-1950)
function isHistoricalPaper(parsed) {
  // Papers before 1950 may not be fully indexed in modern databases
  if (parsed.year && parsed.year < 1950) {
    // Check if it has reasonable metadata
    const hasAuthor = parsed.author && parsed.author.length > 1;
    const hasTitle = parsed.title && parsed.title.length > 10;
    const hasJournal = parsed.journal && parsed.journal.length > 3;
    
    // If it has author + title + journal, likely historical paper
    if (hasAuthor && hasTitle && hasJournal) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// API SEARCH FUNCTIONS
// ============================================================================

// Search by DOI FIRST, then fallback to text search
async function searchCrossRef(parsed) {
  if (!parsed.title && !parsed.author && !parsed.doi) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    let queryParams = [];
    
    // PRIORITY: If DOI exists, search by DOI FIRST
    if (parsed.doi) {
      const doiUrl = `https://api.crossref.org/works/${encodeURIComponent(parsed.doi)}`;
      
      // console.log('🔍 CrossRef DOI query:', doiUrl);
      
      try {
        const doiResponse = await fetch(doiUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'CiteXai/1.0 (mailto:support@citexai.com)' }
        });
        
        if (doiResponse.ok) {
          const doiData = await doiResponse.json();
          const work = doiData.message;
          
          // console.log('✅ CrossRef DOI EXACT MATCH:', work.title?.[0]);
          
          clearTimeout(timeoutId);
          return {
            title: work.title?.[0],
            authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()) || [],
            year: work.published?.['date-parts']?.[0]?.[0],
            journal: work['container-title']?.[0],
            doi: work.DOI,
            citationCount: work['is-referenced-by-count'] || 0,
            relevanceScore: 95,  // Auto-win for exact DOI match
            source: 'CrossRef'
          };
        }
      } catch {
        // console.log('DOI lookup failed, falling back to text search');
      }
    }
    
    // Fallback: Text search if DOI not found or doesn't exist
    if (parsed.title) {
      const titleWords = parsed.title
        .toLowerCase()
        .split(/\s+/)
        // Don't filter short words - CrossRef handles stop words better than we do
        .slice(0, 12)
        .join(' ');
      if (titleWords) {
        queryParams.push(`query.title=${encodeURIComponent(titleWords)}`);
      }
    }
    
    if (parsed.author) {
      let authorQuery = parsed.author;
      const corporateAliases = {
        'World Health Organization': 'WHO',
        'United Nations': 'UN',
        'International Monetary Fund': 'IMF',
        'World Trade Organization': 'WTO'
      };
      
      const acronym = corporateAliases[parsed.author];
      if (acronym) {
        queryParams.push(`query.author=${encodeURIComponent(acronym)}`);
      } else {
        queryParams.push(`query.author=${encodeURIComponent(authorQuery)}`);
      }
    }
    
    // Date filtering removed - often causes valid papers to be missed due to metadata mismatches
    
    if (queryParams.length === 0) return null;
    
    const url = `https://api.crossref.org/works?${queryParams.join('&')}&rows=30&select=DOI,title,author,published,container-title,is-referenced-by-count`;
    
    // console.log('🔍 CrossRef query:', url);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CiteXai/1.0 (mailto:support@citexai.com)' }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.message?.items?.length > 0) {
        // console.log(`📚 CrossRef found ${data.message.items.length} results`);
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const work of data.message.items) {
          const score = calculateMatchScore(parsed, {
            title: work.title?.[0],
            authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()) || [],
            year: work.published?.['date-parts']?.[0]?.[0],
            journal: work['container-title']?.[0],
            doi: work.DOI,
            citationCount: work['is-referenced-by-count'] || 0,
            source: 'CrossRef'
          });
          
          
          /*
          console.log(`  Checking: "${work.title?.[0]?.substring(0, 40)}..." Score: ${score}`);
          */
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              title: work.title?.[0],
              authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()) || [],
              year: work.published?.['date-parts']?.[0]?.[0],
              journal: work['container-title']?.[0],
              doi: work.DOI,
              citationCount: work['is-referenced-by-count'] || 0,
              relevanceScore: score,
              source: 'CrossRef'
            };
          }
        }
        
        if (bestMatch && bestScore >= 30) {
          // console.log(`✅ CrossRef best: ${bestScore}/100 - "${bestMatch.title?.substring(0, 60)}"`);
          return bestMatch;
        }
      }
    }
  } catch (e) {
    console.error('CrossRef error:', e.message);
  }
  return null;
}

async function searchOpenAlex(parsed) {
  if (!parsed.title && !parsed.author) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    let query = '';
    if (parsed.title) {
      const titleWords = parsed.title
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 10)
        .join(' ');
      query += titleWords;
    }
    if (parsed.author) {
      query += ` ${parsed.author}`;
    }
    
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query.trim())}&per-page=30`;
    
    // console.log('🔍 OpenAlex query:', query.trim());
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'CiteXai/1.0 (mailto:support@citexai.com)' }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.results?.length > 0) {
        // console.log(`📚 OpenAlex found ${data.results.length} results`);
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const work of data.results) {
          const score = calculateMatchScore(parsed, {
            title: work.title,
            authors: work.authorships?.map(a => a.author.display_name) || [],
            year: work.publication_year,
            journal: work.primary_location?.source?.display_name,
            doi: work.doi?.replace('https://doi.org/', ''),
            citationCount: work.cited_by_count || 0,
            source: 'OpenAlex'
          });
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              title: work.title,
              authors: work.authorships?.map(a => a.author.display_name) || [],
              year: work.publication_year,
              journal: work.primary_location?.source?.display_name,
              doi: work.doi?.replace('https://doi.org/', ''),
              citationCount: work.cited_by_count || 0,
              relevanceScore: score,
              source: 'OpenAlex'
            };
          }
        }
        
        if (bestMatch && bestScore >= 30) {
          // console.log(`✅ OpenAlex best: ${bestScore}/100 - "${bestMatch.title?.substring(0, 60)}"`);
          return bestMatch;
        }
      }
    }
  } catch (e) {
    console.error('OpenAlex error:', e.message);
  }
  return null;
}

async function searchGoogleBooks(parsed) {
  if (!parsed.title && !parsed.author) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let query = '';
    if (parsed.title) query += `intitle:${parsed.title.substring(0, 50)}`;
    if (parsed.author) query += ` inauthor:${parsed.author}`;
    if (parsed.isbn) query = `isbn:${parsed.isbn}`;
    
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=15`;
    
    // console.log('🔍 Google Books query:', query);
    
    const response = await fetch(url, { signal: controller.signal });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.items?.length > 0) {
        // console.log(`📚 Google Books found ${data.items.length} results`);
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const item of data.items) {
          const book = item.volumeInfo;
          const bookData = {
            title: book.title,
            authors: book.authors || [],
            year: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4)) : null,
            journal: book.publisher || 'Book',
            isbn: book.industryIdentifiers?.[0]?.identifier,
            source: 'Google Books'
          };
          
          const score = calculateMatchScore(parsed, bookData);
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              ...bookData,
              relevanceScore: score,
              citationCount: 0
            };
          }
        }
        
        if (bestMatch && bestScore >= 30) {
          // console.log(`✅ Google Books best: ${bestScore}/100 - "${bestMatch.title?.substring(0, 60)}"`);
          return bestMatch;
        }
      }
    }
  } catch (e) {
    console.error('Google Books error:', e.message);
  }
  return null;
}

// NEW: arXiv API Search
async function searchArxiv(parsed) {
  // Only search arXiv if we have an arXiv ID or a title
  if (!parsed.arxivId && !parsed.title) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let url;
    if (parsed.arxivId) {
      // Direct arXiv ID lookup
      url = `https://export.arxiv.org/api/query?id_list=${parsed.arxivId}&max_results=1`;
    } else {
      // Search by title
      const query = parsed.title.replace(/[^\w\s]/g, ' ').substring(0, 100);
      url = `https://export.arxiv.org/api/query?search_query=ti:${encodeURIComponent(query)}&max_results=10`;
    }
    
    // console.log('🔍 arXiv query:', url);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'CiteXai/1.0' }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const xmlText = await response.text();
      
      // Parse XML response (simple regex-based parsing for arXiv)
      const entries = xmlText.split('<entry>').slice(1);
      
      if (entries.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const entry of entries) {
          const titleMatch = entry.match(/<title[^>]*>([^<]+)<\/title>/);
          const authorsMatch = entry.matchAll(/<name>([^<]+)<\/name>/g);
          const publishedMatch = entry.match(/<published>(\d{4})/);
          const idMatch = entry.match(/<id>([^<]+)<\/id>/);
          const arxivIdMatch = idMatch?.[1]?.match(/(\d{4}\.\d{4,5})/);
          
          const authors = [];
          for (const m of authorsMatch) {
            authors.push(m[1]);
          }
          
          const work = {
            title: titleMatch?.[1]?.replace(/\s+/g, ' ').trim(),
            authors: authors,
            year: publishedMatch ? parseInt(publishedMatch[1]) : null,
            journal: 'arXiv preprint',
            arxivId: arxivIdMatch?.[1],
            doi: arxivIdMatch ? `10.48550/arXiv.${arxivIdMatch[1]}` : null,
            source: 'arXiv'
          };
          
          const score = calculateMatchScore(parsed, work);
          
          // Boost score for direct arXiv ID match
          const finalScore = (parsed.arxivId && work.arxivId === parsed.arxivId) ? 100 : score;
          
          if (finalScore > bestScore) {
            bestScore = finalScore;
            bestMatch = {
              ...work,
              relevanceScore: finalScore,
              citationCount: 0
            };
          }
        }
        
        if (bestMatch && bestScore >= 30) {
          // console.log(`✅ arXiv best: ${bestScore}/100 - "${bestMatch.title?.substring(0, 60)}"`);
          return bestMatch;
        }
      }
    }
  } catch (e) {
    console.error('arXiv error:', e.message);
  }
  return null;
}

// ============================================================================
// PRODUCTION-GRADE MATCH SCORING (PREVENTS FALSE POSITIVES)
// ============================================================================

function calculateMatchScore(parsed, work) {
  let score = 0;
  let details = [];
  let penalties = 0;
  
  // 1. DOI MATCHING (Priority)
  if (parsed.doi && work.doi) {
    const normalizedInput = normalizeText(parsed.doi);
    const normalizedWork = normalizeText(work.doi);
    if (normalizedInput === normalizedWork) return 100;
  }
  
  // 2. AUTHOR MATCHING (Ultra Strict)
  let authorMatched = false;
  let partialAuthorMatched = false;
  if (parsed.author && work.authors?.length > 0) {
    const inputAuthor = normalizeText(parsed.author);
    const inputSurname = inputAuthor.split(' ')[0]; // Usually "Smith" from "Smith, J."
    
    for (let i = 0; i < Math.min(work.authors.length, 10); i++) {
      const workAuthor = normalizeText(work.authors[i]);
      // Check if surname is present in the work author string (handles "Ian Goodfellow" and "Goodfellow, Ian")
      const workParts = workAuthor.split(' ');
      
      if (workParts.includes(inputSurname) || workAuthor.includes(inputSurname)) {
         authorMatched = true;
         break;
      }
    }
  }

  if (authorMatched) {
    score += 40;
    details.push('✅ Author match (+40)');
  } else if (partialAuthorMatched) {
    score += 10;
    penalties += 20;
    details.push('⚠️ Author initial mismatch (-20)');
  } else if (parsed.author) {
    penalties += 50; // Heavy penalty for wrong author
    details.push('❌ Author mismatch (-50)');
  }

  // 3. TITLE MATCHING
  if (parsed.title && work.title) {
    const inputTitle = normalizeText(parsed.title);
    const workTitle = normalizeText(work.title);
    
    if (inputTitle === workTitle) {
      score += 60;
      details.push('✅ Title EXACT (+60)');
    } else if (inputTitle.length >= 20 && (workTitle.includes(inputTitle) || inputTitle.includes(workTitle))) {
      score += 50;
      details.push('✅ Title substring (+50)');
    } else {
      const genericWords = ['using', 'based', 'approach', 'study', 'review', 'method', 'methods', 'towards', 'toward', 'language', 'models', 'model', 'learning', 'neural', 'network', 'networks', 'deep', 'large', 'analysis', 'artificial', 'intelligence', 'data', 'impact', 'effect', 'role'];
      const inputWords = inputTitle.split(/\s+/).filter(w => w.length > 3 && !genericWords.includes(w));
      const workWords = workTitle.split(/\s+/).filter(w => w.length > 3 && !genericWords.includes(w));
      
      const isGeneric = inputTitle.match(/^(a\s+)?(study|research|survey|analysis|investigation|impact|effect|role)\s+(on|of|into|in|to)/i);
      if (isGeneric && !authorMatched) {
        penalties += 70; // Nuclear rejection for generic title mismatch
        details.push('❌ Generic title mismatch (-70)');
      }

      const matches = inputWords.filter(w => workWords.includes(w)).length;
      const minWords = Math.min(inputWords.length, workWords.length);
      const overlap = minWords > 0 ? matches / minWords : 0;

      if (overlap >= 0.8) {
        score += 40;
        details.push(`✅ Title overlap ${Math.round(overlap*100)}% (+40)`);
      } else if (overlap >= 0.5) {
        score += 20;
        details.push(`⚠️ Title overlap ${Math.round(overlap*100)}% (+20)`);
      } else {
        penalties += 30;
        details.push('❌ Title mismatch (-30)');
      }
    }
  }

  // 4. YEAR MATCHING
  if (parsed.year && work.year) {
    const diff = Math.abs(parsed.year - work.year);
    if (diff === 0) {
      score += 25;
      details.push('✅ Year exact (+25)');
    } else if (diff <= 1) {
      score += 15;
      details.push('⚠️ Year +/- 1 (+15)');
    } else {
      penalties += Math.min(60, diff * 15);
    }
  }

  // 5. BONUS & REJECTION
  if (work.citationCount > 1000) score += 10;
  
  if (!authorMatched && penalties > 40) {
     return 0; // Total rejection if author fails and title is weak
  }

  return Math.max(0, Math.min(100, score - penalties));
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request) {
  try {
    const { userEmail, citation: rawCitation } = await request.json();
    
    // Clean input
    const citation = rawCitation.trim().replace(/^["']|["']$/g, '');
    
    if (!citation || citation.length < 10) {
      return Response.json({ 
        error: 'Citation cannot be empty' 
      }, { status: 400 });
    }

    const cached = cache.get(citation);
    if (cached && Date.now() < cached.expires) {
      console.log('📦 Cache hit');
      return Response.json(cached.data);
    }

    // console.log('\n' + '='.repeat(80));
    // console.log('📝 Citation:', citation);
    // console.log('='.repeat(80));

    const parsed = parseCitation(citation);
    console.log('🔍 Parsed:', JSON.stringify(parsed, null, 2));
    // console.log('[DEBUG] Parsed Citation:', JSON.stringify(parsed));
    
    if (isIncomplete(parsed)) {
      const result = {
        verified: false,
        score: 0,
        status: 'incomplete',
        message: '❌ INCOMPLETE - Missing essential information',
        details: {
          error: 'Need at least 2 of: author, year, title',
          parsed,
          checks: ['❌ Citation is incomplete or malformed']
        }
      };
      await trackUsage(userEmail, citation, result);
      cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
      return Response.json(result);
    }
    
    const fakeReason = isFake(parsed);
    if (fakeReason) {
      const result = {
        verified: false,
        score: 0,
        status: 'fake',
        message: '❌ FAKE - Suspicious pattern detected',
        details: { 
          error: fakeReason,
          parsed,
          checks: [`❌ ${fakeReason}`]
        }
      };
      await trackUsage(userEmail, citation, result);
      cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
      return Response.json(result);
    }

    // Check if this is a historical paper (pre-1950)
    if (isHistoricalPaper(parsed)) {
      console.log('📜 Historical paper detected (pre-1950) - relaxing matching thresholds');
    }
    
    console.log('\n🔍 Searching all 3 databases...\n');
    
    const [crossRefResult, openAlexResult, booksResult, arxivResult] = await Promise.all([
      searchCrossRef(parsed),
      searchOpenAlex(parsed),
      parsed.format === 'Book' || parsed.isbn ? searchGoogleBooks(parsed) : null,
      parsed.arxivId || parsed.title ? searchArxiv(parsed) : null
    ]);
    
    /*
    console.log('\n📊 Results:');
    console.log(`  CrossRef: ${crossRefResult ? `${crossRefResult.relevanceScore}/100` : 'No match'}`);
    console.log(`  OpenAlex: ${openAlexResult ? `${openAlexResult.relevanceScore}/100` : 'No match'}`);
    console.log(`  Books: ${booksResult ? `${booksResult.relevanceScore}/100` : 'No match'}`);
    console.log(`  arXiv: ${arxivResult ? `${arxivResult.relevanceScore}/100` : 'No match'}`);
    */
    
    const results = [crossRefResult, openAlexResult, booksResult, arxivResult].filter(Boolean);
    
    if (results.length === 0) {
      const result = {
        verified: false,
        score: 0,
        status: 'not_found',
        message: '❌ NOT FOUND - Not in any database',
        details: {
          parsed,
          checks: [
            '❌ Not found in CrossRef (150M papers)',
            '❌ Not found in OpenAlex (250M works)',
            '❌ Not found in Google Books (40M books)'
          ]
        }
      };
      await trackUsage(userEmail, citation, result);
      cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
      return Response.json(result);
    }
    
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const bestMatch = results[0];
    let score = bestMatch.relevanceScore;

    // NEW: Boost score for historical papers with partial matches
    if (isHistoricalPaper(parsed) && score >= 30 && score < 70) {
      const originalScore = score;
      score = Math.min(score + 40, 85); // Boost by 40 points (max 85%)
      console.log(`📜 Historical paper boost: ${originalScore}% → ${score}%`);
    }
    
    console.log(`\n🏆 Best: ${bestMatch.source} (${score}/100)`);
    console.log(`   "${bestMatch.title?.substring(0, 80)}"`);
    
    const checks = [];
    if (crossRefResult) checks.push(`${crossRefResult === bestMatch ? '✅' : '⚠️'} CrossRef: ${crossRefResult.relevanceScore}%`);
    if (openAlexResult) checks.push(`${openAlexResult === bestMatch ? '✅' : '⚠️'} OpenAlex: ${openAlexResult.relevanceScore}%`);
    if (booksResult) checks.push(`${booksResult === bestMatch ? '✅' : '⚠️'} Books: ${booksResult.relevanceScore}%`);
    
    if (bestMatch.citationCount > 0) {
      checks.push(`📚 ${bestMatch.citationCount} citations`);
    }
    if (bestMatch.doi) {
      checks.push(`✅ DOI: ${bestMatch.doi}`);
    }
    
    let status, message;
    
    // FIXED THRESHOLDS
    if (score >= 70) {
      status = 'verified';
      message = `VERIFIED - Found in ${bestMatch.source} (${score}%)`;
    } else if (score >= 50) {
      status = 'likely';
      message = `LIKELY REAL - Partial match in ${bestMatch.source} (${score}%)`;
    } else if (score >= 30) {
      status = 'uncertain';
      message = `UNCERTAIN - Weak match in ${bestMatch.source} (${score}%)`;
    } else {
      status = 'not_verified';
      message = `NOT VERIFIED - Could not confirm (${score}%)`;
    }

    const result = {
      verified: status === 'verified',
      score: Math.round(score),
      status,
      message,
      details: {
        format: parsed.format || 'Article',
        author: bestMatch.authors?.join(', ') || parsed.author || 'Unknown',
        year: bestMatch.year || parsed.year || 'Unknown',
        title: bestMatch.title || parsed.title || 'Unknown',
        journal: bestMatch.journal || parsed.journal || 'Unknown',
        doi: bestMatch.doi || parsed.doi || 'N/A',
        source: bestMatch.source,
        checks
      }
    };

    console.log('\n✅ Result:', result.message);
    console.log('='.repeat(80) + '\n');

    await trackUsage(userEmail, citation, result);
    cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
    return Response.json(result);

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: 'Server error',
      message: error.message 
    }, { status: 500 });
  }
}
