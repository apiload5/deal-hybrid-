import { supabase, verifyToken, isAdmin } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { type, id, action } = req.body;

    if (!type || !id || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Type, ID, and action are required' 
      });
    }

    let tableName;
    if (type === 'agency') tableName = 'agencies';
    else if (type === 'builder') tableName = 'builders';
    else if (type === 'agent') tableName = 'agents';
    else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid type. Must be agency, builder, or agent' 
      });
    }

    const updateData = {
      is_verified: action === 'verify',
      status: action === 'verify' ? 'active' : 'rejected',
    };

    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    // Also update user role
    if (action === 'verify') {
      const ownerId = data.owner_id || data.user_id;
      if (ownerId) {
        await supabase
          .from('users')
          .update({ role: type })
          .eq('id', ownerId);
      }
    }

    return res.status(200).json({
      success: true,
      message: `${type} ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
      data,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
