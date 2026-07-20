// api/properties/search-suggestions.js
export default async function handler(req, res) {
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
        
        cities.forEach(city => {
            suggestions.push({
                type: 'city',
                value: city.name,
                label: city.name,
                count: 0
            });
        });
        
        areas.forEach(area => {
            suggestions.push({
                type: 'area',
                value: area.name,
                label: `${area.name} (${area.city_id})`,
                count: 0
            });
        });
        
        properties.forEach(prop => {
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

// api/agents/count.js
export default async function handler(req, res) {
    try {
        const { count, error } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            count: count || 0
        });
    } catch (error) {
        console.error('Agents count error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

// api/agencies/count.js
export default async function handler(req, res) {
    try {
        const { count, error } = await supabase
            .from('agencies')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            count: count || 0
        });
    } catch (error) {
        console.error('Agencies count error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

// api/builders/count.js
export default async function handler(req, res) {
    try {
        const { count, error } = await supabase
            .from('builders')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            count: count || 0
        });
    } catch (error) {
        console.error('Builders count error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
