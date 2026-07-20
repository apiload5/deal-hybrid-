import { supabase, verifyToken } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const propertyId = searchParams.get('propertyId');
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit')) || 20;

    let query = supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (propertyId) query = query.eq('property_id', propertyId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('GET videos error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handlePost(req, res) {
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

    const { propertyId, projectId, title, url, platform, thumbnail } = req.body;

    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'Video URL is required' 
      });
    }

    // Verify ownership if propertyId is provided
    if (propertyId) {
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id')
        .eq('id', propertyId)
        .single();

      if (property && property.owner_id !== user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden' 
        });
      }
    }

    const { data, error } = await supabase
      .from('videos')
      .insert([{
        property_id: propertyId || null,
        project_id: projectId || null,
        title: title || '',
        url,
        platform: platform || 'youtube',
        thumbnail: thumbnail || '',
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('POST video error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

async function handleDelete(req, res) {
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

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Video ID is required' 
      });
    }

    // Check ownership
    const { data: video, error: checkError } = await supabase
      .from('videos')
      .select('property_id')
      .eq('id', id)
      .single();

    if (checkError || !video) {
      return res.status(404).json({ 
        success: false, 
        error: 'Video not found' 
      });
    }

    if (video.property_id) {
      const { data: property } = await supabase
        .from('properties')
        .select('owner_id')
        .eq('id', video.property_id)
        .single();

      if (property && property.owner_id !== user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Forbidden' 
        });
      }
    }

    const { error } = await supabase
      .from('videos')
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
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('DELETE video error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
