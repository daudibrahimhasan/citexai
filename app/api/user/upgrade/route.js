
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const { email, plan } = await request.json();

        if (!email || !plan) {
            return NextResponse.json(
                { error: 'Email and plan required' },
                { status: 400 }
            );
        }

        // In a real app, verify payment here (Stripe)

        // Update user tier
        const { data, error } = await supabase
            .from('users')
            .update({
                tier: plan, // 'pro' or 'free'
                updated_at: new Date().toISOString()
            })
            .eq('email', email)
            .select()
            .single();

        if (error) {
            console.error('Database update error:', error);
            return NextResponse.json(
                { error: 'Failed to update user tier' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            user: data,
            message: `Successfully upgraded to ${plan}`
        });

    } catch (error) {
        console.error('Upgrade error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
