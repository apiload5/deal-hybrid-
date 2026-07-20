import { supabase, verifyToken, isAdmin } from '../../lib/supabase.js';

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

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const city = searchParams.get('city');
    const isVerified = searchParams.get('verified');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('builders')
      .select('*, users!owner_id(name, email, phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (city) query = query.eq('city', city);
    if (isVerified === 'true') query = query.eq('is_verified', true);

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
    console.error('GET builders error:', error);
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

    const body = req.body;
    const {
      name,
      description,
      phone,
      email,
      website,
      address,
      city,
      licenseNumber,
      establishedYear,
      projectsCompleted,
    } = body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name is required' 
      });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { data, error } = await supabase
      .from('builders')
      .insert([{
        owner_id: user.id,
        name,
        slug,
        description: description || '',
        phone: phone || '',
        email: email || '',
        website: website || '',
        address: address || '',
        city: city || '',
        license_number: licenseNumber || '',
        established_year: establishedYear || null,
        projects_completed: projectsCompleted || 0,
        status: 'pending',
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
    console.error('POST builder error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
