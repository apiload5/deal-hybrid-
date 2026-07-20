import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name, phone, roleType } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and name are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone: phone || '',
          role: roleType || 'user',
        },
      },
    });

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    // Create user profile
    if (data.user) {
      await supabase
        .from('users')
        .insert([{
          id: data.user.id,
          email: data.user.email,
          name: name,
          phone: phone || '',
          role: roleType || 'user',
        }]);

      // Create agency profile if role is agency
      if (roleType === 'agency') {
        await supabase
          .from('agencies')
          .insert([{
            owner_id: data.user.id,
            name: name,
            email: email,
            phone: phone || '',
            status: 'pending',
          }]);
      }

      // Create builder profile if role is builder
      if (roleType === 'builder') {
        await supabase
          .from('builders')
          .insert([{
            owner_id: data.user.id,
            name: name,
            email: email,
            phone: phone || '',
            status: 'pending',
          }]);
      }

      // Create agent profile if role is agent
      if (roleType === 'agent') {
        await supabase
          .from('agents')
          .insert([{
            user_id: data.user.id,
            company_name: '',
            status: 'pending',
          }]);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please verify your email.',
      user: data.user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
