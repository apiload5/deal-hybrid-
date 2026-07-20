import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  try {
    // Redirect to Supabase Google OAuth
    const redirectUrl = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://your-domain.com/auth/callback',
      },
    });

    res.redirect(redirectUrl.data.url);
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Google authentication failed' 
    });
  }
}
