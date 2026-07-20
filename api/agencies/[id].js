import { supabase, verifyToken, isAdmin } from '../../lib/supabase.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Agency ID is required' 
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
    const { data, error } = await supabase
      .from('agencies')
      .select(`
        *,
        users!owner_id(id, name, email, phone, image),
        agent_agency(
          agents!agent_id(
            id,
            company_name,
            rating,
            total_deals_completed,
            users!user_id(id, name, email)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agency not found' 
      });
    }

    // Get agency properties
    const { data: properties } = await supabase
      .from('properties')
      .select('*')
      .eq('agency_id', id)
      .limit(10);

    // Get agency projects
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('agency_id', id)
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        properties: properties || [],
        projects: projects || [],
      },
    });
  } catch (error) {
    console.error('GET agency error:', error);
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

    const { data: agency, error: checkError } = await supabase
      .from('agencies')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (checkError || !agency) {
      return res.status(404).json({ 
        success: false, 
        error: 'Agency not found' 
      });
    }

    const adminCheck = await isAdmin(user.id);
    if (agency.owner_id !== user.id && !adminCheck) {
      return res.status(403).json({ 
        success: false, 
        error: 'Forbidden' 
      });
    }

    const body = req.body;
    const { data, error } = await supabase
      .from('agencies')
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
    console.error('PUT agency error:', error);
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

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    const { error } = await supabase
      .from('agencies')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Agency deleted successfully',
    });
  } catch (error) {
    console.error('DELETE agency error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
