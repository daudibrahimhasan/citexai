
import { PDFParse } from 'pdf-parse';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      return Response.json({ error: 'Only PDF files allowed' }, { status: 400 });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    try {
      // Use pdf-parse to extract text
      const parser = new PDFParse(buffer);
      const str = await parser.getText();

      // Extract citations using improved regex patterns
      const citationPatterns = [
        // DOI pattern
        /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi,
        // Author (Year) pattern - improved for multi-line
        /(?:[A-Z][a-z]+(?:, [A-Z]\.)?(?:, (?:&|and) [A-Z][a-z]+(?:, [A-Z]\.)?)?|et al\.) \(\d{4}\)(?:\.|\s).*?(?:\.|Journal|Proceedings)/g,
        // Standard reference list pattern (Name, Year. Title)
        /^[A-Z][a-z]+, [A-Z]\..*?\(\d{4}\).*?$/gm
      ];

      let citations = [];

      for (const pattern of citationPatterns) {
        const matches = str.match(pattern);
        if (matches) {
          citations = [...citations, ...matches];
        }
      }

      // Filter and clean citations
      citations = citations
        .map(c => c.trim().replace(/\s+/g, ' '))
        .filter(c => c.length > 20 && c.length < 500) // Reasonable length
        .filter(c => /\d{4}/.test(c)) // Must have a year
        .filter(c => !c.toLowerCase().includes('copyright')) // Exclude copyright notices
        .filter(c => !c.toLowerCase().includes('all rights reserved'));

      // Remove duplicates
      citations = [...new Set(citations)];

      // Limit to 50 citations
      citations = citations.slice(0, 50);

      if (citations.length === 0) {
        // If strict patterns fail, try a looser fallback for reference sections
        // Look for "References" or "Bibliography" and take lines after it
        const refSection = str.match(/(?:References|Bibliography)([\s\S]{500,})/i);
        if (refSection) {
          const lines = refSection[1].split('\n').filter(l => l.length > 30 && /\d{4}/.test(l)).slice(0, 20);
          citations = lines;
        }
      }

      return Response.json({
        success: true,
        citationsFound: citations.length,
        citations: citations,
        message: `Found ${citations.length} potential citations`
      });

    } catch (parseError) {
      console.error('PDF parse error:', parseError);
      return Response.json({
        success: false,
        citationsFound: 0,
        citations: [],
        error: 'Could not parse PDF text. Please ensure it is a valid text-based PDF.'
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: 'Failed to process PDF: ' + error.message },
      { status: 500 }
    );
  }
}
