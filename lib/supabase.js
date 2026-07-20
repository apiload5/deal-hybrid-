import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

export async function verifyToken(token) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return user;
  } catch {
    return null;
  }
}

export async function getUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function getUserRole(userId) {
  const user = await getUser(userId);
  return user?.role || 'user';
}

export async function isAdmin(userId) {
  const role = await getUserRole(userId);
  return role === 'admin';
}

export async function isAgent(userId) {
  const role = await getUserRole(userId);
  return role === 'agent' || role === 'admin';
}

export async function isAgency(userId) {
  const role = await getUserRole(userId);
  return role === 'agency' || role === 'admin';
}

export async function isBuilder(userId) {
  const role = await getUserRole(userId);
  return role === 'builder' || role === 'admin';
}

export async function getAgentProfile(userId) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function getAgencyProfile(userId) {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('owner_id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function getBuilderProfile(userId) {
  const { data, error } = await supabase
    .from('builders')
    .select('*')
    .eq('owner_id', userId)
    .single();
  if (error) return null;
  return data;
}
