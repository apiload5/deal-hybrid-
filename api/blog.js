import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const slug = searchParams.get('slug');
    const limit = parseInt(searchParams.get('limit')) || 9;

    let query = supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });

    if (slug) {
      query = query.eq('slug', slug).single();
    } else {
      query = query.limit(limit);
    }

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
    console.error('Blog error:', error);
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

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    const { title, content, image, slug, excerpt } = req.body;

    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and content are required' 
      });
    }

    const blogSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { data, error } = await supabase
      .from('blogs')
      .insert([{
        title,
        slug: blogSlug,
        content,
        image: image || '',
        excerpt: excerpt || content.substring(0, 150),
        author_id: user.id,
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
    console.error('POST blog error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
