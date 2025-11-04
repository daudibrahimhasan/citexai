export async function POST(request) {
  try {
    const { citation } = await request.json();

    if (!citation || citation.trim().length === 0) {
      return Response.json({ error: 'Citation cannot be empty' }, { status: 400 });
    }

    const doiMatch = citation.match(/10\.\d{4,}\/\S+/);
    const doi = doiMatch ? doiMatch[0] : null;

    if (doi) {
      try {
        const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
        if (response.ok) {
          const data = await response.json();
          const work = data.message;

          return Response.json({
            verified: true,
            score: 98,
            status: 'verified',
            message: '✅ Citation verified in CrossRef!',
            details: {
              title: work.title ? work.title[0] : 'Unknown',
              authors: work.author ? work.author.slice(0, 3).map(a => `${a.given} ${a.family}`).join(', ') : 'Unknown',
              year: work.published ? work.published['date-parts'][0][0] : 'Unknown',
              journal: work['container-title'] ? work['container-title'][0] : 'Unknown',
              doi: doi
            }
          });
        }
      } catch {
        console.log('CrossRef failed');
      }
    }

    return Response.json({
      verified: false,
      score: 30,
      status: 'not_found',
      message: '⚠️ Citation not verified. Check manually.',
      details: { doi: doi }
    });

  } catch (error) {
    return Response.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
