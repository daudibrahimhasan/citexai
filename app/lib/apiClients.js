// ============================================================================
// API CLIENTS - CrossRef, OpenAlex, Semantic Scholar
// ============================================================================

export async function validateDOI(doi) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const work = data.message;

      return {
        valid: true,
        metadata: {
          title: work.title ? work.title[0] : null,
          authors: work.author ? work.author.map(a => `${a.given || ''} ${a.family || ''}`.trim()) : [],
          year: work.published ? work.published['date-parts'][0][0] : null,
          journal: work['container-title'] ? work['container-title'][0] : null,
          doi: doi
        }
      };
    }
  } catch (error) {
    console.error('DOI validation failed:', error.message);
  }
  
  return { valid: false, metadata: null };
}

export async function searchOpenAlex(parsed) {
  if (!parsed.title) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let query = parsed.title.substring(0, 100);
    if (parsed.author) query += ` ${parsed.author}`;

    const response = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const work = data.results[0];
        return {
          title: work.title,
          authors: work.authorships ? work.authorships.map(a => a.author.display_name) : [],
          year: work.publication_year,
          journal: work.primary_location?.source?.display_name || null,
          doi: work.doi ? work.doi.replace('https://doi.org/', '') : null
        };
      }
    }
  } catch (error) {
    console.error('OpenAlex search failed:', error.message);
  }
  
  return null;
}

export async function searchSemanticScholar(parsed) {
  if (!parsed.title) return null;

  try {
    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let query = parsed.title.substring(0, 100);
    if (parsed.author) query += ` ${parsed.author}`;

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,venue,doi&limit=3`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const paper = data.data[0];
        return {
          title: paper.title,
          authors: paper.authors ? paper.authors.map(a => a.name) : [],
          year: paper.year,
          journal: paper.venue,
          doi: paper.doi
        };
      }
    }
  } catch (error) {
    console.error('Semantic Scholar search failed:', error.message);
  }
  
  return null;
}

export function checkMetadataConsistency(parsed, metadata) {
  if (!metadata) return 0;

  let score = 0;
  let checks = 0;

  // Title match
  if (parsed.title && metadata.title) {
    checks++;
    const parsedTitle = parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const metaTitle = metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (parsedTitle.includes(metaTitle.substring(0, 20)) || metaTitle.includes(parsedTitle.substring(0, 20))) {
      score += 35;
    }
  }

  // Author match
  if (parsed.author && metadata.authors && metadata.authors.length > 0) {
    checks++;
    const parsedAuthor = parsed.author.toLowerCase().split(/[,\s]+/)[0];
    const hasMatch = metadata.authors.some(a => 
      a.toLowerCase().includes(parsedAuthor)
    );
    
    if (hasMatch) score += 35;
  }

  // Year match
  if (parsed.year && metadata.year) {
    checks++;
    if (parsed.year === metadata.year) {
      score += 30;
    } else if (Math.abs(parsed.year - metadata.year) === 1) {
      score += 15;
    }
  }

  return checks > 0 ? score : 0;
}

// NEW: Search Google Books API
export async function searchGoogleBooks(parsed) {
  if (!parsed.title) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let query = parsed.title.substring(0, 100);
    if (parsed.author) query += ` ${parsed.author}`;

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const book = data.items[0].volumeInfo;
        return {
          title: book.title,
          authors: book.authors || [],
          year: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4)) : null,
          journal: book.publisher || 'Unknown Publisher',
          isbn: book.industryIdentifiers?.[0]?.identifier || null
        };
      }
    }
  } catch (error) {
    console.error('Google Books search failed:', error.message);
  }
  
  return null;
}
