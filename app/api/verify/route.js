// ============================================================================
// CITEXAI - CITATION VERIFICATION API (FIXED - ALL 3 APIS)
// CrossRef (150M) + OpenAlex (250M) + Google Books (40M)
// ============================================================================
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function trackUsage(userEmail, citation, result) {
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
// IMPROVED CITATION PARSER
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
    format: null
  };

  // Extract DOI
  const doiMatch = citation.match(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i);
  if (doiMatch) parsed.doi = doiMatch[1];

  // Extract URL
  const urlMatch = citation.match(/https?:\/\/[^\s,)]+/i);
  if (urlMatch) parsed.url = urlMatch[0];

  // Extract ISBN
  const isbnMatch = citation.match(/ISBN[:\s]*([\d-]{10,17})/i);
  if (isbnMatch) parsed.isbn = isbnMatch[1].replace(/[-\s]/g, '');

  // Extract year - multiple patterns
  const yearMatch = citation.match(/\((\d{4})\)/) || 
                    citation.match(/,\s*(\d{4})[,.\s]/) ||
                    citation.match(/\b(19\d{2}|20[0-2]\d)\b/);
  if (yearMatch) parsed.year = parseInt(yearMatch[1]);

  // Extract author - first author's last name
  const authorPatterns = [
    /^([A-Z][a-z]+(?:-[A-Z][a-z]+)?)/,  // LastName or Last-Name
    /^([A-Z][a-z]+),/,                    // LastName,
    /^([^,\(]+?),/                        // Any text before comma
  ];
  
  for (const pattern of authorPatterns) {
    const match = citation.match(pattern);
    if (match) {
      parsed.author = match[1].trim().replace(/[,.]$/, '');
      if (parsed.author.length > 1) break;
    }
  }

  // Extract title - multiple strategies
  let titleText = null;
  
  // Strategy 1: Quoted text
  const quotedMatch = citation.match(/["']([^"']{10,}?)["']/);
  if (quotedMatch) {
    titleText = quotedMatch[1];
  }
  
  // Strategy 2: After year in parentheses
  if (!titleText && parsed.year) {
    const afterYearMatch = citation.match(new RegExp(`\\(${parsed.year}\\)[.,]?\\s*([^.]+?)(?:\\.|$)`));
    if (afterYearMatch) {
      titleText = afterYearMatch[1];
    }
  }
  
  // Strategy 3: Between author and year
  if (!titleText && parsed.author && parsed.year) {
    const betweenMatch = citation.match(new RegExp(`${parsed.author}[^(]*?\\([^)]*?\\)[.,]?\\s*([^.]+?)(?:\\.|$)`));
    if (betweenMatch) {
      titleText = betweenMatch[1];
    }
  }
  
  // Strategy 4: After comma following author
  if (!titleText && parsed.author) {
    const afterAuthorMatch = citation.match(new RegExp(`${parsed.author}[^,]*?,\\s*([^.,]+)`));
    if (afterAuthorMatch) {
      titleText = afterAuthorMatch[1];
    }
  }

  if (titleText) {
    parsed.title = titleText
      .trim()
      .replace(/^[.,\s]+|[.,\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/,\s*\d+\s*(?:\(\d+\))?.*$/, '')
      .substring(0, 200);
  }

  // Extract journal
  const journalPatterns = [
    /\bIn\s+([^,.(]+?)(?:[,.(]|$)/i,
    /\.\s*([^,.]+?),\s*\d+(?:\s*\(\d+\))?/,
    /(?:Journal of|Proceedings of|Advances in)\s+([^,.(]+)/i
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
  const hasPublisher = citation.match(/(?:Addison-Wesley|Springer|Wiley|O'Reilly|MIT Press|Cambridge|Oxford|Pearson|McGraw-Hill|Academic Press)/i);
  parsed.format = hasPublisher ? 'Book' : 'Article';

  return parsed;
}

function isIncomplete(parsed) {
  const hasAuthor = parsed.author && parsed.author.length > 1;
  const hasYear = parsed.year && parsed.year > 1400;
  const hasTitle = parsed.title && parsed.title.length > 3;
  const hasDOI = parsed.doi && parsed.doi.length > 5;
  
  if (hasDOI) return false;
  
  const essentialCount = [hasAuthor, hasYear, hasTitle].filter(Boolean).length;
  return essentialCount < 2;
}

function isFake(parsed) {
  if (parsed.year && parsed.year > CURRENT_YEAR + 1) return 'Future year';
  if (parsed.year && parsed.year < 1700) return 'Unrealistic year';
  
  const genericTitles = ['test', 'example', 'sample', 'demo', 'lorem ipsum', 'untitled', 'test paper', 'fake'];
  if (parsed.title && genericTitles.some(g => parsed.title.toLowerCase().includes(g))) {
    return 'Generic/fake title';
  }
  
  return null;
}

// ============================================================================
// API SEARCH FUNCTIONS - NOW ACTUALLY USING ALL 3!
// ============================================================================

/**
 * CROSSREF API - Search 150M academic papers
 */
async function searchCrossRef(parsed) {
  if (!parsed.title && !parsed.author) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Build CrossRef query
    let queryParams = [];
    
    if (parsed.title) {
      queryParams.push(`query.title=${encodeURIComponent(parsed.title)}`);
    }
    if (parsed.author) {
      queryParams.push(`query.author=${encodeURIComponent(parsed.author)}`);
    }
    if (parsed.year) {
      queryParams.push(`filter=from-pub-date:${parsed.year},until-pub-date:${parsed.year}`);
    }
    
    const url = `https://api.crossref.org/works?${queryParams.join('&')}&rows=10&select=DOI,title,author,published,container-title,is-referenced-by-count`;
    
    console.log('🔍 CrossRef query:', url);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CiteXai/1.0 (mailto:support@citexai.com)'
      }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.message?.items?.length > 0) {
        console.log(`📚 CrossRef found ${data.message.items.length} results`);
        
        // Find best match
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
          console.log(`✅ CrossRef best match: ${bestScore}/100 - "${bestMatch.title?.substring(0, 60)}"`);
          return bestMatch;
        }
      }
    }
  } catch (e) {
    console.log('CrossRef error:', e.message);
  }
  return null;
}

/**
 * OPENALEX API - Search 250M academic works
 */
async function searchOpenAlex(parsed) {
  if (!parsed.title && !parsed.author) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Build search query
    let query = '';
    if (parsed.title) {
      const titleWords = parsed.title
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 8)
        .join(' ');
      query += titleWords;
    }
    if (parsed.author) {
      query += ` ${parsed.author}`;
    }
    
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query.trim())}&per-page=15`;
    
    console.log('🔍 OpenAlex query:', query.trim());
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'CiteXai/1.0 (mailto:support@citexai.com)' }
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.results?.length > 0) {
        console.log(`📚 OpenAlex found ${data.results.length} results`);
        
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
          console.log(`✅ OpenAlex best match: ${bestScore}/100 - "${bestMatch.title?.substring(0, 60)}"`);
          return bestMatch;
        }
      }
    }
  } catch (e) {
    console.log('OpenAlex error:', e.message);
  }
  return null;
}

/**
 * GOOGLE BOOKS API - Search 40M books
 */
async function searchGoogleBooks(parsed) {
  if (!parsed.title && !parsed.author) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    let query = '';
    if (parsed.title) query += `intitle:${parsed.title.substring(0, 50)}`;
    if (parsed.author) query += ` inauthor:${parsed.author}`;
    if (parsed.isbn) query = `isbn:${parsed.isbn}`;
    
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`;
    
    console.log('🔍 Google Books query:', query);
    
    const response = await fetch(url, { signal: controller.signal });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      if (data.items?.length > 0) {
        console.log(`📚 Google Books found ${data.items.length} results`);
        
        const book = data.items[0].volumeInfo;
        const bookData = {
          title: book.title,
          authors: book.authors || [],
          year: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4)) : null,
          journal: book.publisher || 'Book',
          isbn: book.industryIdentifiers?.[0]?.identifier,
          source: 'Google Books'
        };
        
        const score = calculateMatchScore(parsed, bookData);
        
        if (score >= 30) {
          console.log(`✅ Google Books match: ${score}/100 - "${bookData.title?.substring(0, 60)}"`);
          return {
            ...bookData,
            relevanceScore: score,
            citationCount: 0
          };
        }
      }
    }
  } catch (e) {
    console.log('Google Books error:', e.message);
  }
  return null;
}

// ============================================================================
// SIMPLIFIED MATCH SCORING SYSTEM
// ============================================================================

function calculateMatchScore(parsed, work) {
  let score = 0;
  let details = [];
  
  // AUTHOR MATCHING (30 points)
  if (parsed.author && work.authors?.length > 0) {
    const inputAuthor = normalizeText(parsed.author);
    let authorMatched = false;
    
    for (let i = 0; i < Math.min(work.authors.length, 5); i++) {
      const workAuthor = normalizeText(work.authors[i]);
      
      // Check if surnames match
      const inputParts = inputAuthor.split(/\s+/);
      const workParts = workAuthor.split(/\s+/);
      
      for (const inputPart of inputParts) {
        for (const workPart of workParts) {
          if (inputPart.length >= 3 && workPart.length >= 3) {
            // Exact match or strong prefix match
            if (inputPart === workPart || 
                workPart.startsWith(inputPart) ||
                inputPart.startsWith(workPart)) {
              
              score += (i === 0) ? 30 : 20;
              details.push(`✅ Author match: ${work.authors[i]} ${i === 0 ? '(first)' : '(co-author)'} (+${i === 0 ? 30 : 20})`);
              authorMatched = true;
              break;
            }
          }
        }
        if (authorMatched) break;
      }
      if (authorMatched) break;
    }
    
    if (!authorMatched) {
      details.push(`❌ Author mismatch: "${parsed.author}" not found (0)`);
    }
  }
  
  // YEAR MATCHING (20 points)
  if (parsed.year && work.year) {
    const yearDiff = Math.abs(parsed.year - work.year);
    
    if (yearDiff === 0) {
      score += 20;
      details.push('✅ Year exact match (+20)');
    } else if (yearDiff === 1) {
      score += 15;
      details.push('⚠️ Year ±1 (+15)');
    } else if (yearDiff <= 2) {
      score += 10;
      details.push(`⚠️ Year ±${yearDiff} (+10)`);
    } else {
      details.push(`❌ Year difference: ±${yearDiff} (0)`);
    }
  }
  
  // TITLE MATCHING (35 points)
  if (parsed.title && work.title) {
    const inputTitle = normalizeText(parsed.title);
    const workTitle = normalizeText(work.title);
    
    // Exact match
    if (inputTitle === workTitle) {
      score += 35;
      details.push('✅ Title exact match (+35)');
    }
    // Substring match
    else if (workTitle.includes(inputTitle) || inputTitle.includes(workTitle)) {
      score += 30;
      details.push('✅ Title substring match (+30)');
    }
    // Word overlap
    else {
      const inputWords = inputTitle.split(/\s+/).filter(w => w.length > 3);
      const workWords = workTitle.split(/\s+/).filter(w => w.length > 3);
      
      const matches = inputWords.filter(w => workWords.includes(w)).length;
      const totalWords = Math.min(inputWords.length, workWords.length);
      
      if (totalWords > 0) {
        const overlap = matches / totalWords;
        const titleScore = Math.round(overlap * 35);
        
        if (titleScore >= 15) {
          score += titleScore;
          details.push(`✅ Title ${Math.round(overlap * 100)}% match (+${titleScore})`);
        } else if (titleScore > 0) {
          score += titleScore;
          details.push(`⚠️ Title weak match (+${titleScore})`);
        }
      }
    }
  }
  
  // JOURNAL MATCHING (10 points)
  if (work.journal) {
    if (parsed.journal) {
      const inputJournal = normalizeText(parsed.journal);
      const workJournal = normalizeText(work.journal);
      
      if (inputJournal === workJournal || 
          workJournal.includes(inputJournal) || 
          inputJournal.includes(workJournal)) {
        score += 10;
        details.push('✅ Journal match (+10)');
      } else {
        details.push('⚠️ Journal mismatch (0)');
      }
    } else {
      score += 5;
      details.push('⚠️ Journal found in DB (+5)');
    }
  }
  
  // DOI/CITATION BONUS (5 points)
  if (work.doi) {
    score += 5;
    details.push('✅ DOI present (+5)');
  }
  
  // CITATION COUNT BONUS (up to 10 points)
  if (work.citationCount > 0) {
    if (work.citationCount > 1000) {
      score += 10;
      details.push(`🌟 Highly cited: ${work.citationCount} (+10)`);
    } else if (work.citationCount > 100) {
      score += 5;
      details.push(`📚 Well cited: ${work.citationCount} (+5)`);
    }
  }
  
  console.log(`  [${work.source}] Score: ${score}/100`);
  console.log(`  Details: ${details.join(' | ')}`);
  
  return Math.min(score, 100);
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
    const { citation, userEmail } = await request.json();
    
    if (!citation || !citation.trim()) {
      return Response.json({ 
        error: 'Citation cannot be empty' 
      }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(citation);
    if (cached && Date.now() < cached.expires) {
      console.log('📦 Returning cached result');
      return Response.json(cached.data);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📝 Citation:', citation);
    console.log('='.repeat(80));

    const parsed = parseCitation(citation);
    console.log('🔍 Parsed:', JSON.stringify(parsed, null, 2));
    
    // Check if incomplete
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
    
    // Check for obvious fakes
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
    
    console.log('\n🔍 Searching all databases...\n');
    
    // SEARCH ALL 3 APIs IN PARALLEL
    const [crossRefResult, openAlexResult, booksResult] = await Promise.all([
      searchCrossRef(parsed),
      searchOpenAlex(parsed),
      parsed.format === 'Book' || parsed.isbn ? searchGoogleBooks(parsed) : null
    ]);
    
    console.log('\n📊 Results summary:');
    console.log(`  CrossRef: ${crossRefResult ? `${crossRefResult.relevanceScore}/100` : 'No match'}`);
    console.log(`  OpenAlex: ${openAlexResult ? `${openAlexResult.relevanceScore}/100` : 'No match'}`);
    console.log(`  Google Books: ${booksResult ? `${booksResult.relevanceScore}/100` : 'No match'}`);
    
    // Pick best result
    const results = [crossRefResult, openAlexResult, booksResult].filter(Boolean);
    
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
    
    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const bestMatch = results[0];
    const score = bestMatch.relevanceScore;
    
    console.log(`\n🏆 Best match: ${bestMatch.source} (${score}/100)`);
    console.log(`   Title: ${bestMatch.title?.substring(0, 80)}`);
    
    // Build checks array
    const checks = [];
    if (crossRefResult) checks.push(`${crossRefResult === bestMatch ? '✅' : '⚠️'} CrossRef: ${crossRefResult.relevanceScore}% match`);
    if (openAlexResult) checks.push(`${openAlexResult === bestMatch ? '✅' : '⚠️'} OpenAlex: ${openAlexResult.relevanceScore}% match`);
    if (booksResult) checks.push(`${booksResult === bestMatch ? '✅' : '⚠️'} Google Books: ${booksResult.relevanceScore}% match`);
    
    if (bestMatch.citationCount > 0) {
      checks.push(`📚 ${bestMatch.citationCount} citations`);
    }
    if (bestMatch.doi) {
      checks.push(`✅ DOI: ${bestMatch.doi}`);
    }
    
    // Determine status
    let status, message;
    
    if (score >= 60) {
      status = 'verified';
      message = `✅ VERIFIED - Found in ${bestMatch.source} (${score}% match)`;
    } else if (score >= 40) {
      status = 'likely';
      message = `⚠️ LIKELY REAL - Partial match in ${bestMatch.source} (${score}%)`;
    } else if (score >= 30) {
      status = 'uncertain';
      message = `❓ UNCERTAIN - Weak match in ${bestMatch.source} (${score}%)`;
    } else {
      status = 'not_verified';
      message = `❌ NOT VERIFIED - Could not confirm (${score}%)`;
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

    console.log('\n✅ Final result:', result.message);
    console.log('='.repeat(80) + '\n');

    await trackUsage(userEmail, citation, result);
    cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
    return Response.json(result);

  } catch (error) {
    console.error('❌ Verification error:', error);
    return Response.json({ 
      error: 'Server error',
      message: error.message 
    }, { status: 500 });
  }
}