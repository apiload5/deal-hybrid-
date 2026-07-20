import { supabase, verifyToken, getAgentProfile } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

    // Get stats
    const [
      { count: totalProperties },
      { count: totalDeals },
      { count: totalViews },
    ] = await Promise.all([
      supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentProfile.id),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentProfile.id),
      supabase
        .from('property_views')
        .select('*', { count: 'exact', head: true })
        .in('property_id', 
          supabase.from('properties').select('id').eq('agent_id', agentProfile.id)
        ),
    ]);

    // Get recent properties
    const { data: recentProperties } = await supabase
      .from('properties')
      .select('*')
      .eq('agent_id', agentProfile.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent deals
    const { data: recentDeals } = await supabase
      .from('deals')
      .select('*, properties!property_id(title)')
      .eq('agent_id', agentProfile.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return res.status(200).json({
      success: true,
      data: {
        agent: agentProfile,
        stats: {
          totalProperties: totalProperties || 0,
          totalDeals: totalDeals || 0,
          totalViews: totalViews || 0,
        },
        recentProperties: recentProperties || [],
        recentDeals: recentDeals || [],
      },
    });
  } catch (error) {
    console.error('Agent dashboard error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
