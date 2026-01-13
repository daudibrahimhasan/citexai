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

    const searchQuery = citation.replace(/[^\w\s]/g, ' ').trim();

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
          
          // Extract title words from citation (filter out author, year, etc)
          const yearMatch = citation.match(/\((\d{4})\)/);
          const year = yearMatch ? parseInt(yearMatch[1]) : null;
          
          // Try to extract just the title part from the citation
          let titlePart = citation;
          // Remove author at start (e.g., "Garcia, M. (2019)." or similar)
          titlePart = titlePart.replace(/^[A-Z][^.]+\.\s*\(\d{4}\)\.\s*/, '');
          // Remove DOI, URL at end
          titlePart = titlePart.replace(/https?:\/\/[^\s]+/g, '').replace(/\s+/g, ' ').trim();
          
          const citationWords = getWords(titlePart);
          // console.log('📝 Citation title words:', citationWords.slice(0, 10).join(', '));

          for (const work of data.results) {
            const workTitle = work.title || '';
            const workWords = getWords(workTitle);
            const workYear = work.publication_year;
            
            // Calculate word overlap
            const matchingWords = citationWords.filter(w => workWords.includes(w));
            const overlap = citationWords.length > 0 ? matchingWords.length / citationWords.length : 0;
            
            let score = 0;
            
            // Title word matching (max 60 points)
            if (overlap >= 0.7) {
              score += 60;
            } else if (overlap >= 0.5) {
              score += 40;
            } else if (overlap >= 0.3) {
              score += 20;
            }
            
            // Author matching (max 25 points)
            if (firstAuthor && work.authorships) {
              const hasAuthor = work.authorships.some(a => {
                const name = a.author.display_name.toLowerCase();
                const lastName = name.split(' ').pop();
                return lastName === firstAuthor || name.includes(firstAuthor);
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
          
          // Only accept matches with score >= 50 (need good title OR author+year match)
          if (bestMatch && bestScore >= 50) {
            // console.log(`✅ Found OpenAlex match (score: ${bestScore}):`, bestMatch.title);
            
            const work = bestMatch;

            // Build APA citation
            const authors = work.authorships?.slice(0, 7).map(a => {
              const name = a.author.display_name;
              const parts = name.split(' ');
              const last = parts[parts.length - 1];
              const initials = parts.slice(0, -1).map(p => p[0] + '.').join(' ');
              return `${last}, ${initials}`;
            }) || [];

            const authorText = authors.length > 3
              ? authors.slice(0, 3).join(', ') + ', et al.'
              : authors.join(', ') || 'Unknown';

            const doi = work.doi?.replace('https://doi.org/', '') || '';
            const venue = work.primary_location?.source?.display_name || 'Unknown';
            const year = work.publication_year || 'n.d.';

            const apa = `${authorText} (${year}). ${work.title}. ${venue}${doi ? `. https://doi.org/${doi}` : ''}.`;

            return Response.json({
              success: true,
              suggestion: {
                suggestions: { APA: apa },
                metadata: {
                  title: work.title,
                  authors: authors,
                  year: year,
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
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json({
        success: false,
        error: 'Could not fix citation'
      }, { status: 404 });
    }

    // console.log('🤖 Using Groq AI...');

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
              content: 'You are a citation expert. For famous papers like GPT-3 (Brown 2020), Transformer (Vaswani 2017), return ONLY the APA format citation. Be concise.'
            },
            {
              role: 'user',
              content: `Fix this citation and return ONLY APA format:\n\n"${citation}"`
            }
          ],
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (groqResponse.ok) {
        const groqData = await groqResponse.json();
        let fixedCitation = groqData.choices[0].message.content;

        // Extract only APA if multiple formats returned
        const apaMatch = fixedCitation.match(/(?:APA:\s*)?(.+?)(?=\n\nMLA:|$)/s);
        fixedCitation = apaMatch ? apaMatch[1].trim() : fixedCitation.trim();

        // Remove "APA:" prefix if present
        fixedCitation = fixedCitation.replace(/^APA:\s*/i, '');

        // console.log('✅ Groq AI returned');
        // console.log('   Tokens:', groqData.usage?.total_tokens);

        return Response.json({
          success: true,
          suggestion: {
            suggestions: { APA: fixedCitation },
            metadata: null
          },
          source: 'CiteXai AI',
          confidence: 90,
          usage: groqData.usage
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
