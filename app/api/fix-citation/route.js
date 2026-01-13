
export async function POST(req) {
  try {
    const { citation } = await req.json();

    if (!citation || citation.trim().length === 0) {
      return Response.json({ success: false, error: 'Citation cannot be empty' }, { status: 400 });
    }

    // console.log('🔍 Fixing citation:', citation);

    // Extract author names - IMPROVED regex
    // Looks for: name followed by comma, or "et al", or typical (Year) pattern
    const authorMatches = citation.match(/^([A-Z][a-z]+(?:-[A-Z][a-z]+)?)(?:,\s+([A-Z]\.?\s?)+|\s+\(\d{4}\)|\s+et\s+al)/);
    const firstAuthor = authorMatches?.[1]?.toLowerCase();
    
    // console.log('📝 Detected author (heuristic):', firstAuthor);

    // TRY OPENALEX FIRST (FREE)
    // console.log('📡 Trying OpenAlex (free)...');

    const yearMatch = citation.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    // Build a cleaner search query: First Author + Title words
    let searchQuery = citation;
    if (firstAuthor) {
       searchQuery = `${firstAuthor} ${citation.replace(/^[A-Z][^.]+\./, '').substring(0, 100)}`;
    }
    searchQuery = searchQuery.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

    try {
      const openAlexResponse = await fetch(
        `https://api.openalex.org/works?search=${encodeURIComponent(searchQuery)}&per-page=10`,
        {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'CiteXai/1.0' }
        }
      );

      if (openAlexResponse.ok) {
        const data = await openAlexResponse.json();

        if (data.results && data.results.length > 0) {
          // console.log(`📊 Found ${data.results.length} results`);

          // Find best match using Title AND Author with STRICT scoring
          let bestMatch = null;
          let bestScore = 0;
          
          const normalize = (s) => s ? s.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
          const getWords = (s) => normalize(s).split(/\s+/).filter(w => w.length > 3);
          
          // Try to extract just the title part from the citation
          let titlePart = citation;
          // Handle various formats to extract title
          titlePart = titlePart.replace(/^[A-Z][^.]+\.\s*\(\d{4}\)\.\s*/, ''); // APA style
          titlePart = titlePart.replace(/https?:\/\/[^\s]+/g, '').replace(/\s+/g, ' ').trim();
          
          const citationWords = getWords(titlePart);

          for (const work of data.results) {
            const workTitle = work.title || '';
            const workWords = getWords(workTitle);
            const workYear = work.publication_year;
            
            // Calculate word overlap
            const matchingWords = citationWords.filter(w => workWords.includes(w));
            const overlap = (citationWords.length > 0) ? matchingWords.length / citationWords.length : 0;
            
            let score = 0;
            
            // Title word matching (max 60 points) - Be more lenient on overlap
            if (overlap >= 0.6) {
              score += 60;
            } else if (overlap >= 0.4) {
              score += 40;
            } else if (overlap >= 0.2) {
              score += 20;
            }
            
            // Author matching (max 25 points)
            if (firstAuthor && work.authorships) {
              const hasAuthor = work.authorships.some(a => {
                const name = a.author?.display_name?.toLowerCase() || '';
                return name.includes(firstAuthor);
              });
              if (hasAuthor) score += 25;
            }
            
            // Year matching (max 15 points)
            if (year && workYear) {
              if (year === workYear) score += 15;
              else if (Math.abs(year - workYear) <= 1) score += 8;
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = work;
            }
          }
          
          // Accept matches with score >= 45 (relaxed slightly)
          if (bestMatch && bestScore >= 45) {
            const work = bestMatch;

            // Build APA citation
            const authors = work.authorships?.slice(0, 7).map(a => {
              const name = a.author.display_name;
              const parts = name.split(' ');
              const last = parts[parts.length - 1];
              const initials = parts[0] ? parts[0][0] + '.' : '';
              return `${last}, ${initials}`;
            }) || [];

            const authorText = (authors.length > 3)
              ? authors.slice(0, 3).join(', ') + ', et al.'
              : authors.join(', ') || 'Unknown';

            const doi = work.doi?.replace('https://doi.org/', '') || '';
            const venue = work.primary_location?.source?.display_name || 'Unknown';
            const pubYear = work.publication_year || 'n.d.';

            let apa = `${authorText} (${pubYear}). ${work.title}. ${venue}${doi ? `. https://doi.org/${doi}` : ''}.`;

            // NO-OP DETECTION: If the fix is functionally the same as input
            const normInput = citation.toLowerCase().replace(/[^\w]/g, '');
            const normApa = apa.toLowerCase().replace(/[^\w]/g, '');
            
            if (normInput === normApa || (normInput.includes(normApa) && citation.length - apa.length < 15)) {
                 return Response.json({
                   success: true,
                   isAlreadyCorrect: true,
                   message: 'Citation is already in a correct format.',
                   suggestion: { suggestions: { APA: citation } }
                 });
            }

            return Response.json({
              success: true,
              suggestion: {
                suggestions: { APA: apa },
                metadata: {
                  title: work.title,
                  authors: authors,
                  year: pubYear,
                  journal: venue,
                  doi: doi
                }
              },
              source: 'OpenAlex',
              confidence: 95
            });
          } else {
            // console.log('⚠️ No good OpenAlex match, falling back to Groq AI');
          }
        }
      }
    } catch (e) {
      console.error('OpenAlex error:', e.message);
    }

    // FALLBACK TO GROQ AI
    // We only use AI if OpenAlex failed to find a high-confidence match.
    // If the citation already has a year and looks structured, we might skip AI 
    // to avoid hallucinating fixes for hallucinations, but let's be more lenient.
    
    // Check if it's potentially nonsensical 
    if (citation.length < 15) {
      return Response.json({ success: false, error: 'Input too short to fix' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json({
        success: false,
        error: 'Could not fix citation'
      }, { status: 404 });
    }

    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a citation expert. Return ONLY the corrected APA format citation string. No explanation, no intro, no conversational filler. If the input is correct, return it as is. If it is a hallucinated/fake paper, return ONLY the word "INVALID".'
            },
            {
              role: 'user',
              content: `APA format for: "${citation}"`
            }
          ],
          temperature: 0.1,
          max_tokens: 200
        })
      });

      if (groqResponse.ok) {
        const groqData = await groqResponse.json();
        let fixedCitation = groqData.choices[0].message.content.trim();
        
        if (fixedCitation.toUpperCase().includes('INVALID') || fixedCitation.length < 10) {
           return Response.json({ success: false, error: 'Could not verify or fix this citation' }, { status: 400 });
        }

        // Remove any common AI conversational prefixes if they slipped through
        fixedCitation = fixedCitation.replace(/^(Here is the citation|Proper APA format:|The corrected citation is:)\s*/i, '');
        fixedCitation = fixedCitation.replace(/^"|"$/g, ''); // Remove quotes

        // 🚀 NEW: Try to find metadata (DOI/Link) for this AI-fixed citation
        // The AI cleaned up the text, so now OpenAlex search might actually work!
        let metadata = null;
        try {
           // Extract title from fixed citation (between (Year). and .)
           const titleMatch = fixedCitation.match(/\(\d{4}\)\.\s*([^.]+)\./);
           if (titleMatch) {
             const cleanTitle = titleMatch[1];
             const searchRes = await fetch(
               `https://api.openalex.org/works?search=${encodeURIComponent(cleanTitle)}&per-page=1`,
               { headers: { 'User-Agent': 'CiteXai/1.0' } }
             );
             if (searchRes.ok) {
               const searchData = await searchRes.json();
               if (searchData.results?.[0]) {
                 const best = searchData.results[0];
                 // Verify it matches our fixed citation keywords
                 const fixedWords = fixedCitation.toLowerCase().split(/\s+/);
                 const foundWords = (best.title || '').toLowerCase().split(/\s+/);
                 const intersection = fixedWords.filter(w => foundWords.includes(w));
                 
                 // If good overlap, assume it's the right paper
                 if (intersection.length > 3) {
                   const doi = best.doi?.replace('https://doi.org/', '');
                   // const workId = best.id; // Unused
                   
                   metadata = {
                     title: best.title,
                     year: best.publication_year,
                     doi: doi,
                     url: best.doi || best.id
                   };
                   
                   // Append DOI/URL if not present
                   if (doi && !fixedCitation.includes(doi) && !fixedCitation.includes('doi.org')) {
                     fixedCitation = fixedCitation.replace(/\.$/, '') + `. https://doi.org/${doi}`;
                   } else if (!doi && best.primary_location?.pdf_url && !fixedCitation.includes('http')) {
                      // Fallback to PDF URL if no DOI
                      fixedCitation = fixedCitation.replace(/\.$/, '') + `. ${best.primary_location.pdf_url}`;
                   }
                 }
               }
             }
           }
        } catch (err) {
          console.error('Metadata enrichment failed:', err);
        }

        return Response.json({
          success: true,
          isAlreadyCorrect: false, 
          suggestion: {
            suggestions: { APA: fixedCitation },
            metadata: metadata // Return richer metadata if found
          },
          source: 'CiteXai AI + Verification',
          confidence: metadata ? 95 : 70 // Boost confidence if we found the DOI
        });
      }
    } catch (e) {
      console.error('❌ Groq error:', e.message);
    }

    return Response.json({
      success: false,
      error: 'Could not fix citation'
    }, { status: 404 });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
