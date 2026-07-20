import { supabase, verifyToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Property ID is required' 
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, id);
  }

  if (req.method === 'PUT') {
    return handlePut(req, res, id);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res, id);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res, id) {
  try {
    // Increment view count
    await supabase.rpc('increment_property_views', { property_id: id });

    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        users!owner_id(id, name, phone, email, image),
        agents!agent_id(
          id,
          company_name,
          phone,
          rating,
          total_deals_completed,
          verified,
          users!user_id(id, name, email)
        ),
        reviews(
          id,
          rating,
          comment,
          created_at,
          users!user_id(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'Property not found' 
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET property error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handlePut(req, res, id) {
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

    // Check ownership
    const { data: property, error: checkError } = await supabase
      .from('properties')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (checkError || !property) {
      return res.status(404).json({ 
        success: false, 
        error: 'Property not found' 
      });
    }

    const userRole = await getUserRole(user.id);
    if (property.owner_id !== user.id && userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Forbidden' 
      });
    }

    const body = req.body;
    const { data, error } = await supabase
      .from('properties')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('PUT property error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleDelete(req, res, id) {
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

    // Check ownership
    const { data: property, error: checkError } = await supabase
      .from('properties')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (checkError || !property) {
      return res.status(404).json({ 
        success: false, 
        error: 'Property not found' 
      });
    }

    const userRole = await getUserRole(user.id);
    if (property.owner_id !== user.id && userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Forbidden' 
      });
    }

    // Soft delete
    const { error } = await supabase
      .from('properties')
      .update({ 
        status: 'deleted', 
        deleted_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Property deleted successfully',
    });
  } catch (error) {
    console.error('DELETE property error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
