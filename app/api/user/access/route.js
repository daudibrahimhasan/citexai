import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({
        tier: 'free',
        usage_count: 0,
        limit: 25,
        unlimited: false
      });
    }

    // Define limits based on tier
    const limits = {
      free: 25,
      pro: Infinity,
      team: Infinity
    };

    const limit = limits[user.tier] || 25;
    const unlimited = user.tier === 'pro' || user.tier === 'team';

    // Check if usage needs to be reset (30 days passed)
    const resetDate = new Date(user.usage_reset_date);
    const now = new Date();
    
    if (now > resetDate) {
      // Reset usage count
      await supabase
        .from('users')
        .update({
          usage_count: 0,
          usage_reset_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('email', email);

      return NextResponse.json({
        tier: user.tier,
        usage_count: 0,
        limit,
        unlimited,
        reset: true
      });
    }

    return NextResponse.json({
      tier: user.tier,
      usage_count: user.usage_count,
      limit,
      unlimited,
      remaining: unlimited ? Infinity : Math.max(0, limit - user.usage_count)
    });

  } catch (error) {
    console.error('Error checking user access:', error);
    return NextResponse.json(
      { error: 'Failed to check access' },
      { status: 500 }
    );
  }
}
