import pdf from 'pdf-parse';

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

    // Extract text from PDF
    const data = await pdf(buffer);
    const text = data.text;

    // Extract citations using regex
    const citationPatterns = [
      // DOI pattern
      /10\.\d{4,}\/[^\s]+/g,
      // Author (Year) pattern
      /[A-Z][a-z]+,?\s+[A-Z]\..*?\(\d{4}\).*?\..*?\./g,
      // Title in quotes pattern
      /"[^"]{20,}"/g
    ];

    let citations = [];
    
    for (const pattern of citationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        citations = [...citations, ...matches];
      }
    }

    // Remove duplicates
    citations = [...new Set(citations)];

    // Limit to 50 citations (premium can be unlimited)
    citations = citations.slice(0, 50);

    return Response.json({
      success: true,
      citationsFound: citations.length,
      citations: citations,
      pageCount: data.numpages,
      message: `Found ${citations.length} potential citations`
    });

  } catch (error) {
    return Response.json(
      { error: 'Failed to process PDF: ' + error.message },
      { status: 500 }
    );
  }
}
