// ============================================================================
// CITEXAI - SMART CITATION FIXER WITH GROK AI
// Uses verified metadata from databases + Grok AI fallback
// ============================================================================

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// CITATION PARSER (Same as verify route)
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

  const yearMatch = citation.match(/\((\d{4})\)/) || 
                    citation.match(/,\s*(\d{4})[,.\s]/) ||
                    citation.match(/\b(19\d{2}|20[0-2]\d)\b/);
  if (yearMatch) parsed.year = parseInt(yearMatch[1]);

  let authorMatch = citation.match(/^([A-Z][a-z]+(?:,\s*[A-Z]\.?(?:\s*[A-Z]\.?)?)?)/);
  if (!authorMatch) authorMatch = citation.match(/^([A-Z][a-z]+(?:\s+et\s+al\.?)?)/);
  if (!authorMatch) authorMatch = citation.match(/^([^(]+?)(?=\s*\(?\d{4}\)?)/);
  if (authorMatch) parsed.author = authorMatch[1].trim().replace(/[,.]$/g, '');

  let titleMatch = citation.match(/["']([^"']+)["']/);
  if (!titleMatch) titleMatch = citation.match(/\(\d{4}\)\.\s*([^.]+?)(?:\.|,\s*(?:In|Journal|Nature|Science))/i);
  if (!titleMatch) titleMatch = citation.match(/\d{4}\D+?([A-Z][^.]+?)\.?\s*(?:Journal|Nature|Science)/i);
  if (titleMatch) parsed.title = titleMatch[1].trim();

  const journalMatch = citation.match(/(?:Journal|Proceedings|In|Advances in)\s+([^,\d]+?)(?:[,.\d]|$)/i);
  if (journalMatch) parsed.journal = journalMatch[1].trim();

  return parsed;
}

// ============================================================================
// DATABASE SEARCH FUNCTIONS
// ============================================================================

async function validateDOI(doi) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: controller.signal
    });

    if (response.ok) {
      const data = await response.json();
      const work = data.message;
      return {
        title: work.title?.[0],
        authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()) || [],
        year: work.published?.['date-parts']?.[0]?.[0],
        journal: work['container-title']?.[0],
        volume: work.volume,
        issue: work.issue,
        pages: work.page,
        doi: doi
      };
    }
  } catch (e) {
    console.log('CrossRef error:', e.message);
  }
  return null;
}

async function searchOpenAlex(parsed) {
  if (!parsed.title && !parsed.author) return null;
  
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    
    let query = '';
    if (parsed.title) query += parsed.title.substring(0, 80);
    if (parsed.author) query += ` ${parsed.author.substring(0, 30)}`;
    
    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query.trim())}`,
      { signal: controller.signal }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.results?.[0]) {
        const work = data.results[0];
        return {
          title: work.title,
          authors: work.authorships?.map(a => a.author.display_name) || [],
          year: work.publication_year,
          journal: work.primary_location?.source?.display_name,
          doi: work.doi?.replace('https://doi.org/', '')
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
    setTimeout(() => controller.abort(), 3000);
    
    let query = parsed.title.substring(0, 80);
    if (parsed.author) query += ` ${parsed.author.substring(0, 30)}`;
    
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`,
      { signal: controller.signal }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.items?.[0]) {
        const book = data.items[0].volumeInfo;
        return {
          title: book.title,
          authors: book.authors || [],
          year: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4)) : null,
          publisher: book.publisher,
          isbn: book.industryIdentifiers?.[0]?.identifier
        };
      }
    }
  } catch (e) {
    console.log('Google Books error:', e.message);
  }
  return null;
}

// ============================================================================
// GROK AI INTEGRATION
// ============================================================================

async function fixWithGrokAI(citation, parsed) {
  try {
    const prompt = `You are a citation expert. Fix this broken/incomplete citation and return ONLY valid JSON.

Broken citation: "${citation}"

Extracted info:
- Author: ${parsed.author || 'unknown'}
- Year: ${parsed.year || 'unknown'}
- Title: ${parsed.title || 'unknown'}
- Journal: ${parsed.journal || 'unknown'}

Task: Search your knowledge base for this paper. If you find it, return properly formatted citations in APA, MLA, and Chicago styles. If you can't find it, return an error.

Return ONLY this JSON format (no markdown, no explanation):
{
  "found": true/false,
  "metadata": {
    "title": "Full Paper Title",
    "authors": ["Author 1", "Author 2"],
    "year": 2023,
    "journal": "Journal Name",
    "doi": "10.xxxx/xxxxx" (if available, else null)
  },
  "citations": {
    "APA": "Author, A. (Year). Title. Journal, Volume(Issue), Pages. DOI",
    "MLA": "Author. \"Title.\" Journal Volume.Issue (Year): Pages.",
    "Chicago": "Author. \"Title.\" Journal Volume, no. Issue (Year): Pages."
  }
}`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a citation expert. Always return valid JSON. Never use markdown code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.error('Grok API error:', response.status);
      return null;
    }

    const data = await response.json();
    const grokResponse = data.choices?.[0]?.message?.content;
    
    if (!grokResponse) return null;

    // Parse Grok's JSON response
    const cleanJson = grokResponse.replace(/``````\n?/g, '').trim();
    const result = JSON.parse(cleanJson);

    if (result.found && result.metadata && result.citations) {
      return result;
    }

  } catch (e) {
    console.error('Grok AI error:', e.message);
  }
  
  return null;
}

// ============================================================================
// CITATION FORMATTERS
// ============================================================================

function formatAuthor(authorName) {
  const parts = authorName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(n => n[0] ? n[0] + '.' : '').join(' ');
  return `${last}, ${initials}`;
}

function generateAPACitation(metadata) {
  if (!metadata) return null;

  const authors = metadata.authors?.slice(0, 7) || [];
  let authorStr;
  
  if (authors.length === 0) {
    authorStr = 'Unknown Author';
  } else if (authors.length === 1) {
    authorStr = formatAuthor(authors[0]);
  } else if (authors.length === 2) {
    authorStr = `${formatAuthor(authors[0])}, & ${formatAuthor(authors[1])}`;
  } else if (authors.length <= 7) {
    const formatted = authors.slice(0, -1).map(a => formatAuthor(a));
    authorStr = `${formatted.join(', ')}, & ${formatAuthor(authors[authors.length - 1])}`;
  } else {
    authorStr = `${formatAuthor(authors[0])}, et al.`;
  }

  const year = metadata.year || 'n.d.';
  const title = metadata.title || 'Untitled';
  
  if (metadata.journal) {
    let citation = `${authorStr} (${year}). ${title}. ${metadata.journal}`;
    if (metadata.volume) citation += `, ${metadata.volume}`;
    if (metadata.issue) citation += `(${metadata.issue})`;
    if (metadata.pages) citation += `, ${metadata.pages}`;
    if (metadata.doi) citation += `. https://doi.org/${metadata.doi}`;
    return citation;
  }
  
  if (metadata.publisher) {
    return `${authorStr} (${year}). ${title}. ${metadata.publisher}.`;
  }

  return `${authorStr} (${year}). ${title}.`;
}

function generateMLACitation(metadata) {
  if (!metadata) return null;

  const authors = metadata.authors || [];
  let authorStr;
  
  if (authors.length === 0) {
    authorStr = 'Unknown Author';
  } else if (authors.length === 1) {
    const parts = authors[0].trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    authorStr = `${last}, ${first}`;
  } else {
    const parts = authors[0].trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    authorStr = `${last}, ${first}, et al.`;
  }

  const year = metadata.year || 'n.d.';
  const title = metadata.title ? `"${metadata.title}"` : '"Untitled"';
  
  if (metadata.journal) {
    let citation = `${authorStr}. ${title}. ${metadata.journal}`;
    if (metadata.volume) citation += ` ${metadata.volume}`;
    if (metadata.issue) citation += `.${metadata.issue}`;
    citation += ` (${year})`;
    if (metadata.pages) citation += `: ${metadata.pages}`;
    if (metadata.doi) citation += `. https://doi.org/${metadata.doi}`;
    return citation;
  }
  
  if (metadata.publisher) {
    return `${authorStr}. ${title}. ${metadata.publisher}, ${year}.`;
  }

  return `${authorStr}. ${title}. ${year}.`;
}

function generateChicagoCitation(metadata) {
  if (!metadata) return null;

  const authors = metadata.authors || [];
  let authorStr;
  
  if (authors.length === 0) {
    authorStr = 'Unknown Author';
  } else {
    const parts = authors[0].trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    authorStr = authors.length > 1 ? `${last}, ${first}, et al.` : `${last}, ${first}`;
  }

  const year = metadata.year || 'n.d.';
  const title = metadata.title ? `"${metadata.title}"` : '"Untitled"';
  
  if (metadata.journal) {
    let citation = `${authorStr}. ${title}. ${metadata.journal}`;
    if (metadata.volume) citation += ` ${metadata.volume}`;
    if (metadata.issue) citation += `, no. ${metadata.issue}`;
    citation += ` (${year})`;
    if (metadata.pages) citation += `: ${metadata.pages}`;
    if (metadata.doi) citation += `. https://doi.org/${metadata.doi}`;
    return citation;
  }
  
  if (metadata.publisher) {
    return `${authorStr}. ${title}. ${metadata.publisher}, ${year}.`;
  }

  return `${authorStr}. ${title}. ${year}.`;
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request) {
  try {
    const { citation } = await request.json();

    if (!citation || citation.trim().length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Citation cannot be empty' 
      }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(citation);
    if (cached && Date.now() < cached.expires) {
      return Response.json(cached.data);
    }

    const parsed = parseCitation(citation);
    console.log('Fixing citation, parsed:', parsed);
    
    let metadata = null;
    let source = null;

    // Priority 1: Check DOI
    if (parsed.doi) {
      console.log('Validating DOI...');
      metadata = await validateDOI(parsed.doi);
      if (metadata) source = 'CrossRef';
    }

    // Priority 2: Search databases
    if (!metadata) {
      console.log('Searching databases...');
      const [openalexResult, bookResult] = await Promise.all([
        searchOpenAlex(parsed),
        searchGoogleBooks(parsed)
      ]);
      
      metadata = openalexResult || bookResult;
      source = openalexResult ? 'OpenAlex' : bookResult ? 'Google Books' : null;
    }

    // Priority 3: Use Grok AI
    if (!metadata) {
      console.log('Using Grok AI to find/fix citation...');
      const grokResult = await fixWithGrokAI(citation, parsed);
      
      if (grokResult && grokResult.found) {
        const result = {
          success: true,
          source: 'Grok AI',
          original: citation,
          suggestions: grokResult.citations,
          metadata: grokResult.metadata
        };
        cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
        return Response.json(result);
      }
    }

    // If we found metadata from databases, generate citations
    if (metadata) {
      const result = {
        success: true,
        source: source,
        original: citation,
        suggestions: {
          APA: generateAPACitation(metadata),
          MLA: generateMLACitation(metadata),
          CHICAGO: generateChicagoCitation(metadata)
        },
        metadata: {
          title: metadata.title,
          authors: metadata.authors,
          year: metadata.year,
          journal: metadata.journal || metadata.publisher,
          doi: metadata.doi || metadata.isbn || 'N/A'
        }
      };
      
      cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
      return Response.json(result);
    }

    // Not found anywhere
    const result = {
      success: false,
      error: 'Could not find this citation in any database or AI knowledge base',
      suggestion: 'Please check the citation details and try again'
    };
    
    cache.set(citation, { data: result, expires: Date.now() + CACHE_TTL });
    return Response.json(result);

  } catch (error) {
    console.error('Fix citation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Server error' 
    }, { status: 500 });
  }
}
