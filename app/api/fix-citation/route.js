export async function POST(req) {
  try {
    const { citation } = await req.json();
    
    if (!citation || citation.trim().length === 0) {
      return Response.json({ success: false, error: 'Citation cannot be empty' }, { status: 400 });
    }
    
    console.log('🔍 Fixing citation:', citation);
    
    // Extract author names
    const authorMatches = citation.match(/^([A-Z][a-z]+)(?:\s+[A-Z])?(?:,\s+([A-Z][a-z]+))?/);
    const firstAuthor = authorMatches?.[1]?.toLowerCase();
    const secondAuthor = authorMatches?.[2]?.toLowerCase();
    
    console.log('📝 Detected authors:', { firstAuthor, secondAuthor });
    
    // TRY OPENALEX FIRST (FREE)
    console.log('📡 Trying OpenAlex (free)...');
    
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
          console.log(`📊 Found ${data.results.length} results`);
          
          // Find paper with matching authors
          let bestMatch = null;
          
          if (firstAuthor) {
            bestMatch = data.results.find(work => {
              if (!work.authorships) return false;
              
              const hasFirstAuthor = work.authorships.some(a => {
                const name = a.author.display_name.toLowerCase();
                const lastName = name.split(' ').pop();
                return lastName === firstAuthor || name.includes(firstAuthor);
              });
              
              if (secondAuthor && hasFirstAuthor) {
                return work.authorships.some(a => {
                  const name = a.author.display_name.toLowerCase();
                  const lastName = name.split(' ').pop();
                  return lastName === secondAuthor || name.includes(secondAuthor);
                });
              }
              
              return hasFirstAuthor;
            });
            
            if (bestMatch) {
              console.log('✅ Found match by author:', bestMatch.title);
            } else {
              console.log('⚠️ No author match, using Groq AI');
              throw new Error('No author match');
            }
          }
          
          if (!bestMatch) {
            bestMatch = data.results[0];
          }
          
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
            suggestion: apa,  // ✅ Only APA
            source: 'OpenAlex',
            confidence: 95
          });
        }
      }
    } catch (e) {
      console.log('⚠️ OpenAlex error:', e.message);
    }
    
    // FALLBACK TO GROQ AI
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return Response.json({ 
        success: false, 
        error: 'Could not fix citation' 
      }, { status: 404 });
    }
    
    console.log('🤖 Using Groq AI...');
    
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
        
        console.log('✅ Groq AI returned');
        console.log('   Tokens:', groqData.usage?.total_tokens);
        
        return Response.json({
          success: true,
          suggestion: fixedCitation,  // ✅ Clean APA only
          source: 'Groq AI',
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
