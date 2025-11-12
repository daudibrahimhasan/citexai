// ============================================================================
// CITATION PARSER - Extract fields from APA/MLA/Chicago/BibTeX
// ============================================================================

export function parseCitation(citation) {
  const parsed = {
    author: null,
    year: null,
    title: null,
    journal: null,
    volume: null,
    issue: null,
    pages: null,
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

  // Extract year
  const yearMatch = citation.match(/\((\d{4})\)/) || citation.match(/,\s*(\d{4})[,.\s]/);
  if (yearMatch) parsed.year = parseInt(yearMatch[1]);

  // Extract author
  const authorMatch = citation.match(/^([^(,0-9]+?)(?:\(|,\s*\d{4})/);
  if (authorMatch) parsed.author = authorMatch[1].trim().replace(/\.$/, '');

  // Extract title - IMPROVED for books
  let titleMatch = citation.match(/["']([^"']+)["']/);
  if (!titleMatch) {
    titleMatch = citation.match(/\(\d{4}\)\.\s*([^:]+(?::[^.]+)?)\./);
  }
  if (!titleMatch) {
    titleMatch = citation.match(/\(\d{4}\)[.,]?\s*([^.]+?)(?:\.|,\s*(?:In|Journal|Proceedings|Retrieved))/i);
  }
  if (titleMatch) {
    parsed.title = titleMatch[1]
      .trim()
      .replace(/\s*\(\d+(?:st|nd|rd|th)?\s*ed\.?\)\.?$/, '')
      .replace(/\.$/, '');
  }

  // Extract journal
  const journalMatch = citation.match(/(?:Journal|Proceedings|In)\s+([^,\d]+?)(?:[,.\d]|$)/i);
  if (journalMatch) parsed.journal = journalMatch[1].trim();

  // Extract volume/issue/pages
  const volumeMatch = citation.match(/\b(\d+)\s*\(/);
  if (volumeMatch) parsed.volume = volumeMatch[1];

  const issueMatch = citation.match(/\((\d+)\)/);
  if (issueMatch && issueMatch[1] !== String(parsed.year)) {
    parsed.issue = issueMatch[1];
  }

  const pagesMatch = citation.match(/pp?\.\s*(\d+[-–]\d+)/i);
  if (pagesMatch) parsed.pages = pagesMatch[1];

  // Detect book format - FIXED: MOVED INSIDE FUNCTION
  const hasPublisher = citation.match(/(?:Addison-Wesley|Springer|Wiley|O'Reilly|MIT Press|Cambridge|Oxford|Pearson|McGraw-Hill)/i);
  const hasEdition = citation.match(/\(\d+(?:st|nd|rd|th)?\s*ed\.?\)/i);

  if (hasPublisher || hasEdition) {
    parsed.format = 'Book (APA)';
    const publisherMatch = citation.match(/([A-Z][a-z]+(?:-[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)*)\.?\s*$/);
    if (publisherMatch) parsed.journal = publisherMatch[1];
  } else if (citation.includes('@article') || citation.includes('@book')) {
    parsed.format = 'BibTeX';
  } else if (citation.match(/^[A-Z][^(]+\(\d{4}\)/)) {
    parsed.format = 'APA';
  } else if (citation.match(/^[A-Z][^"]+["'][^"']+["']/)) {
    parsed.format = 'MLA';
  } else {
    parsed.format = 'Unknown';
  }

  return parsed;
}
