import { supabase, verifyToken, getAgentProfile } from '../../lib/supabase.js';

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
    const purpose = searchParams.get('purpose');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const beds = searchParams.get('beds');
    const baths = searchParams.get('baths');
    const areaMin = searchParams.get('areaMin');
    const areaMax = searchParams.get('areaMax');
    const furnished = searchParams.get('furnished');
    const isPremium = searchParams.get('isPremium') === 'true';
    const isFeatured = searchParams.get('isFeatured') === 'true';
    const limit = parseInt(searchParams.get('limit')) || 20;
    const page = parseInt(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;
    const search = searchParams.get('search');

    let query = supabase
      .from('properties')
      .select('*, users!owner_id(id, name, phone, email), agents!agent_id(id, company_name, rating)', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,city.ilike.%${search}%,area.ilike.%${search}%`);
    }
    if (city) query = query.eq('city', city);
    if (type) query = query.eq('property_type', type);
    if (purpose) query = query.eq('purpose', purpose);
    if (minPrice) query = query.gte('price', parseInt(minPrice));
    if (maxPrice) query = query.lte('price', parseInt(maxPrice));
    if (beds) query = query.gte('beds', parseInt(beds));
    if (baths) query = query.gte('baths', parseInt(baths));
    if (areaMin) query = query.gte('area_sqft', parseInt(areaMin));
    if (areaMax) query = query.lte('area_sqft', parseInt(areaMax));
    if (furnished) query = query.eq('furnished', furnished);
    if (isPremium) query = query.eq('is_premium', true);
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
    console.error('GET properties error:', error);
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
      title,
      description,
      price,
      city,
      area,
      propertyType,
      purpose,
      beds,
      baths,
      areaSqft,
      furnished,
      floor,
      builtYear,
      images,
      videoUrl,
      videoPlatform,
      latitude,
      longitude,
    } = body;

    if (!title || !price || !city || !area || !propertyType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Required fields missing' 
      });
    }

    // Check if user is agent
    const agentProfile = await getAgentProfile(user.id);
    const status = agentProfile ? 'approved' : 'pending';

    const { data, error } = await supabase
      .from('properties')
      .insert([{
        title,
        description: description || '',
        price,
        price_formatted: `Rs ${price.toLocaleString()}`,
        city,
        area,
        property_type: propertyType,
        purpose: purpose || 'sale',
        beds: beds || 0,
        baths: baths || 0,
        area_sqft: areaSqft || 0,
        furnished: furnished || '',
        floor: floor || null,
        built_year: builtYear || null,
        images: images || ['/placeholder-property.jpg'],
        video_url: videoUrl || '',
        video_platform: videoPlatform || 'youtube',
        latitude: latitude || null,
        longitude: longitude || null,
        owner_id: user.id,
        agent_id: agentProfile?.id || null,
        status: status,
        is_featured: false,
        is_premium: false,
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
    console.error('POST property error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
