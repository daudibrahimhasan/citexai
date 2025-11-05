export async function POST(request) {
  try {
    const { citation } = await request.json();

    if (!citation) {
      return Response.json({ 
        error: 'No citation provided' 
      }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      console.error('ERROR: GROQ_API_KEY is not set!');
      return Response.json({ 
        error: 'API key not configured. Please set GROQ_API_KEY in .env.local',
        suggestion: 'Please add your citation manually'
      });
    }

    console.log('Calling Groq API with citation:', citation);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',  // ✅ NEW MODEL (was mixtral-8x7b-32768)
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `You are an expert at fixing academic citations. Fix this citation and make it professional. Return ONLY the fixed citation, nothing else: "${citation}"`
          }
        ]
      })
    });

    const data = await response.json();

    console.log('Groq response:', data);

    if (!response.ok) {
      console.error('Groq API error:', data);
      return Response.json({ 
        error: `Groq API error: ${data.error?.message || 'Unknown error'}`,
        suggestion: citation
      });
    }

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const suggestion = data.choices[0].message.content.trim();
      return Response.json({
        success: true,
        suggestion: suggestion
      });
    }

    return Response.json({ 
      error: 'No response from AI',
      suggestion: citation
    });

  } catch (error) {
    console.error('Server error in fix-citation:', error);
    return Response.json({ 
      error: `Server error: ${error.message}`,
      suggestion: 'Please try again later'
    }, { status: 500 });
  }
}
