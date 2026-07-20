import { supabase, verifyToken, isAdmin } from '../../lib/supabase.js';

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

  const adminCheck = await isAdmin(user.id);
  if (!adminCheck) {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'PUT') {
    return handlePut(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(searchParams.get('limit')) || 50;
    const page = parseInt(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('users')
      .select('*, agents!user_id(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
    console.error('GET users error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handlePut(req, res) {
  try {
    const { userId, role, isVerified } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Update user role
    if (role) {
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);

      if (error) {
        return res.status(400).json({ 
          success: false, 
          error: error.message 
        });
      }
    }

    // Update agent verification
    if (isVerified !== undefined) {
      const { error } = await supabase
        .from('agents')
        .update({ verified: isVerified })
        .eq('user_id', userId);

      if (error && error.code !== 'PGRST116') {
        return res.status(400).json({ 
          success: false, 
          error: error.message 
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('PUT user error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleDelete(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('DELETE user error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
