import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  // CORS headers - Blogger se call ke liye zaroori
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(200).json({ success: true, data: [] });
  }
  
  try {
    // Search cities
    const { data: cities } = await supabase
      .from('cities')
      .select('name')
      .ilike('name', `%${q}%`)
      .limit(5);
    
    // Search areas
    const { data: areas } = await supabase
      .from('areas')
      .select('name, city_id')
      .ilike('name', `%${q}%`)
      .limit(5);
    
    // Search property titles
    const { data: properties } = await supabase
      .from('properties')
      .select('title, id')
      .ilike('title', `%${q}%`)
      .limit(5);
    
    const suggestions = [];
    
    cities?.forEach(city => {
      suggestions.push({
        type: 'city',
        value: city.name,
        label: city.name,
        count: 0
      });
    });
    
    areas?.forEach(area => {
      suggestions.push({
        type: 'area',
        value: area.name,
        label: `${area.name}`,
        count: 0
      });
    });
    
    properties?.forEach(prop => {
      suggestions.push({
        type: 'property',
        value: prop.title,
        label: prop.title,
        count: 0
      });
    });
    
    return res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
