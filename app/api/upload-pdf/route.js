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

    // Simple text extraction (works in production)
    try {
      // Try to extract basic info from PDF
      const str = buffer.toString('binary');
      
      // Extract citations using regex patterns
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
        const matches = str.match(pattern);
        if (matches) {
          citations = [...citations, ...matches];
        }
      }

      // Remove duplicates
      citations = [...new Set(citations)];

      // Limit to 50 citations
      citations = citations.slice(0, 50);

      return Response.json({
        success: true,
        citationsFound: citations.length,
        citations: citations,
        message: `Found ${citations.length} potential citations`
      });

    } catch (parseError) {
      console.error('PDF parse error:', parseError);
      return Response.json({
        success: true,
        citationsFound: 0,
        citations: [],
        message: 'PDF uploaded but could not extract citations'
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
