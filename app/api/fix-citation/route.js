export async function POST(request) {
  try {
    const { citation } = await request.json();

    if (!citation || typeof citation !== 'string' || citation.trim().length === 0) {
      return Response.json({ success: false, error: 'Citation cannot be empty' }, { status: 400 });
    }

    // Simple normalization heuristics to "fix" citation text.
    let s = citation.trim();

    // Collapse multiple whitespace/newlines into single space
    s = s.replace(/\s+/g, ' ');

    // Ensure there's a period at the end
    if (!/[.!?]$/.test(s)) s = s + '.';

    // Fix common spacing after periods (e.g. "Smith, J.(2023)" -> "Smith, J. (2023)")
    s = s.replace(/\.\s*/g, '. ');
    s = s.replace(/\)\s*\./g, ').');

    // Normalize DOI if present (remove surrounding punctuation)
    const doiMatch = s.match(/(10\.\d{4,}\/\S+)/);
    if (doiMatch) {
      const doi = doiMatch[1].replace(/[.,;]$/, '');
      // move DOI to end if not already at end
      if (!s.endsWith(doi)) {
        s = s.replace(doiMatch[1], '').trim();
        if (!s.endsWith('.')) s += '.';
        s = s + ' ' + doi;
      }
    }

    // Capitalize first character (simple)
    s = s.charAt(0).toUpperCase() + s.slice(1);

    // Return a suggestion
    return Response.json({ success: true, suggestion: s });
  } catch (error) {
    return Response.json({ success: false, error: String(error.message || error) }, { status: 500 });
  }
}
