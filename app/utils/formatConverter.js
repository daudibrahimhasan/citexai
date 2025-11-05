export function formatCitation(details, format = 'APA') {
  const { authors, year, title, journal, doi } = details;
  
  switch(format.toUpperCase()) {
    case 'APA':
      return `${authors} (${year}). ${title}. *${journal}*. https://doi.org/${doi}`;
      
    case 'MLA':
      return `${authors}. "${title}." *${journal}*, ${year}. doi:${doi}`;
      
    case 'CHICAGO':
      return `${authors}. "${title}." *${journal}* (${year}). https://doi.org/${doi}`;
      
    case 'HARVARD':
      return `${authors} ${year}, '${title}', *${journal}*. Available at: https://doi.org/${doi}`;
      
    default:
      return `${authors} (${year}). ${title}. ${journal}. ${doi}`;
  }
}

export function formatAuthors(authorsList, format = 'APA') {
  if (!authorsList || authorsList.length === 0) return 'Unknown';
  
  const authors = authorsList.split(',').map(a => a.trim());
  
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  if (authors.length > 2) {
    return format === 'MLA' 
      ? `${authors[0]}, et al.`
      : `${authors[0]}, ${authors[1]}, ... & ${authors[authors.length - 1]}`;
  }
  
  return authorsList;
}
