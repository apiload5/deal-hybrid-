import { supabase, verifyToken, getAgentProfile } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized' 
    });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }

  const agentProfile = await getAgentProfile(user.id);
  if (!agentProfile) {
    return res.status(403).json({ 
      success: false, 
      error: 'Not an agent' 
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, agentProfile);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res, agentProfile) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentProfile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Agent properties error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
