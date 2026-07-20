import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Admin client (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Public client (uses RLS)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Verify JWT token and get user
export async function verifyToken(token) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw new Error('Invalid token');
    return user;
  } catch (error) {
    return null;
  }
}

// Get user role
export async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !data) return 'user';
  return data.role;
}

// Check if user is admin
export async function isAdmin(userId) {
  const role = await getUserRole(userId);
  return role === 'admin';
}

// Check if user is agent
export async function isAgent(userId) {
  const role = await getUserRole(userId);
  return role === 'agent' || role === 'admin';
}

// Get agent profile
export async function getAgentProfile(userId) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) return null;
  return data;
}
