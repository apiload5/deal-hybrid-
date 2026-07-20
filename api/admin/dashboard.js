import { supabase, verifyToken, isAdmin } from '../../lib/supabase.js';

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

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    // Get all stats
    const [
      { count: totalUsers },
      { count: totalAgents },
      { count: totalProperties },
      { count: totalDeals },
      { count: totalPayments },
      { count: totalViews },
      { count: pendingProperties },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true }),
      supabase.from('property_views').select('*', { count: 'exact', head: true }),
      supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    // Get recent activities
    const { data: recentActivities } = await supabase
      .from('properties')
      .select('*, users!owner_id(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers: totalUsers || 0,
          totalAgents: totalAgents || 0,
          totalProperties: totalProperties || 0,
          totalDeals: totalDeals || 0,
          totalPayments: totalPayments || 0,
          totalViews: totalViews || 0,
          pendingProperties: pendingProperties || 0,
        },
        recentActivities: recentActivities || [],
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
