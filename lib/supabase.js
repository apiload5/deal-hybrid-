import { createClient } from '@supabase/supabase-js';

let _supabase = null;
let _supabasePublic = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

function getSupabasePublic() {
  if (!_supabasePublic) {
    _supabasePublic = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }
  return _supabasePublic;
}

// Proxy banao taake purana code na toote
export const supabase = new Proxy({}, {
  get: (_, prop) => getSupabase()[prop]
});

export const supabasePublic = new Proxy({}, {
  get: (_, prop) => getSupabasePublic()[prop]
});

export async function verifyToken(token) {
  try {
    const { data: { user }, error } = await getSupabase().auth.getUser(token);
    if (error) throw error;
    return user;
  } catch {
    return null;
  }
}

export async function getUser(userId) {
  const { data, error } = await getSupabase()
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
  const { data, error } = await getSupabase()
   .from('agents')
   .select('*')
   .eq('user_id', userId)
   .single();
  if (error) return null;
  return data;
}

export async function getAgencyProfile(userId) {
  const { data, error } = await getSupabase()
   .from('agencies')
   .select('*')
   .eq('owner_id', userId)
   .single();
  if (error) return null;
  return data;
}

export async function getBuilderProfile(userId) {
  const { data, error } = await getSupabase()
   .from('builders')
   .select('*')
   .eq('owner_id', userId)
   .single();
  if (error) return null;
  return data;
}
