import { supabase, verifyToken, isBuilder, isAgency } from '../../lib/supabase.js';

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
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const isFeatured = searchParams.get('featured') === 'true';
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('projects')
      .select('*, builders!builder_id(name, logo), agencies!agency_id(name, logo)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (city) query = query.eq('city', city);
    if (type) query = query.eq('project_type', type);
    if (status) query = query.eq('status', status);
    if (isFeatured) query = query.eq('is_featured', true);

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
    console.error('GET projects error:', error);
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

    const isBuilderUser = await isBuilder(user.id);
    const isAgencyUser = await isAgency(user.id);

    if (!isBuilderUser && !isAgencyUser) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only builders and agencies can create projects' 
      });
    }

    const body = req.body;
    const {
      title,
      description,
      projectType,
      status,
      location,
      city,
      area,
      priceRangeMin,
      priceRangeMax,
      totalUnits,
      images,
      videoUrl,
      features,
      amenities,
      completionDate,
    } = body;

    if (!title || !city) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and city are required' 
      });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    let builderId = null;
    let agencyId = null;

    if (isBuilderUser) {
      const builder = await supabase
        .from('builders')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      builderId = builder.data?.id;
    }

    if (isAgencyUser) {
      const agency = await supabase
        .from('agencies')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      agencyId = agency.data?.id;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([{
        title,
        slug,
        description: description || '',
        project_type: projectType || 'residential',
        status: status || 'planned',
        location: location || '',
        city,
        area: area || '',
        price_range_min: priceRangeMin || null,
        price_range_max: priceRangeMax || null,
        total_units: totalUnits || 0,
        images: images || [],
        video_url: videoUrl || '',
        features: features || [],
        amenities: amenities || [],
        completion_date: completionDate || null,
        builder_id: builderId,
        agency_id: agencyId,
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
    console.error('POST project error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
