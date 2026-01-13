import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!supabase) return true; // Allow sign in without DB if supabase not configured

      // Save or update user in Supabase
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();

        if (existingUser) {
          // Update last_login
          await supabase
            .from('users')
            .update({
              last_login: new Date().toISOString(),
              name: user.name,
              image: user.image
            })
            .eq('email', user.email);
        } else {
          // Create new user
          await supabase
            .from('users')
            .insert({
              email: user.email,
              name: user.name,
              image: user.image,
              tier: 'free',
              usage_count: 0,
              usage_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        return true;
      } catch (error) {
        console.error('Error saving user to database:', error);
        return true; // Allow sign-in even if database save fails
      }
    },
    async session({ session, token }) {
      // Add user email to session
      if (session?.user) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
