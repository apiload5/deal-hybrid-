// server.js - Complete Backend Server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// SUPABASE CLIENT
// ============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Deal.pk API Server Running',
        version: '2.0.0',
        endpoints: {
            auth: '/api/auth/login, /api/auth/register',
            properties: '/api/properties',
            cities: '/api/cities',
            agencies: '/api/agencies',
            builders: '/api/builders',
            projects: '/api/projects'
        }
    });
});

// ============================================
// AUTH ROUTES
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email and password are required' 
            });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ 
                success: false, 
                error: error.message 
            });
        }

        return res.status(200).json({
            success: true,
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email, password, and name are required' 
            });
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, phone: phone || '', role: 'user' },
            },
        });

        if (error) {
            return res.status(400).json({ 
                success: false, 
                error: error.message 
            });
        }

        if (data.user) {
            await supabase
                .from('users')
                .insert([{
                    id: data.user.id,
                    email: data.user.email,
                    name: name,
                    phone: phone || '',
                    role: 'user',
                }]);
        }

        return res.status(201).json({
            success: true,
            message: 'Registration successful!',
            user: data.user,
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// PROPERTIES ROUTES
// ============================================

// Get all properties
app.get('/api/properties', async (req, res) => {
    try {
        const { city, type, purpose, minPrice, maxPrice, beds, limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('properties')
            .select('*, users!owner_id(name, phone, email)', { count: 'exact' })
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (city) query = query.eq('city', city);
        if (type) query = query.eq('property_type', type);
        if (purpose) query = query.eq('purpose', purpose);
        if (minPrice) query = query.gte('price', parseInt(minPrice));
        if (maxPrice) query = query.lte('price', parseInt(maxPrice));
        if (beds) query = query.gte('beds', parseInt(beds));

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
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (error) {
        console.error('GET properties error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get single property
app.get('/api/properties/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Increment view count
        await supabase.rpc('increment_property_views', { property_id: id });

        const { data, error } = await supabase
            .from('properties')
            .select(`
                *,
                users!owner_id(name, phone, email, image),
                agents!agent_id(
                    id,
                    company_name,
                    phone,
                    rating,
                    total_deals_completed,
                    verified,
                    users!user_id(name, email)
                ),
                reviews(
                    id,
                    rating,
                    comment,
                    created_at,
                    users!user_id(name)
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
});

// ============================================
// CITIES ROUTES
// ============================================

app.get('/api/cities', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cities')
            .select('*, areas!city_id(id, name, slug, lat, lng)')
            .order('name');

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
        console.error('Cities error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get areas by city
app.get('/api/cities/:id/areas', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('areas')
            .select('*')
            .eq('city_id', id)
            .order('name');

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
        console.error('Areas error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// AREAS ROUTES
// ============================================

app.get('/api/areas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('areas')
            .select('*, cities!city_id(name)')
            .order('name');

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
        console.error('Areas error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// AGENCIES ROUTES
// ============================================

app.get('/api/agencies', async (req, res) => {
    try {
        const { city, limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('agencies')
            .select('*, users!owner_id(name, email, phone)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (city) query = query.eq('city', city);

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
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (error) {
        console.error('Agencies error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// BUILDERS ROUTES
// ============================================

app.get('/api/builders', async (req, res) => {
    try {
        const { city, limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('builders')
            .select('*, users!owner_id(name, email, phone)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (city) query = query.eq('city', city);

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
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (error) {
        console.error('Builders error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// PROJECTS ROUTES
// ============================================

app.get('/api/projects', async (req, res) => {
    try {
        const { city, type, status, limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('projects')
            .select('*, builders!builder_id(name, logo), agencies!agency_id(name, logo)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (city) query = query.eq('city', city);
        if (type) query = query.eq('project_type', type);
        if (status) query = query.eq('status', status);

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
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (error) {
        console.error('Projects error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// AREA GUIDES
// ============================================

app.get('/api/area-guides', async (req, res) => {
    try {
        const areaGuides = [
            {
                city: 'Islamabad',
                description: 'The capital city of Pakistan, known for its beautiful landscapes and modern infrastructure.',
                areas: ['DHA Phase 1-8', 'Bahria Town', 'F-6', 'F-7', 'F-8', 'G-10', 'Blue Area'],
                averagePrice: 'Rs 35,000,000',
                image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Islamabad',
            },
            {
                city: 'Karachi',
                description: 'The economic hub of Pakistan, offering diverse property options for all budgets.',
                areas: ['DHA Phase 1-8', 'Clifton', 'Defence View', 'Bahria Town Karachi'],
                averagePrice: 'Rs 25,000,000',
                image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Karachi',
            },
            {
                city: 'Lahore',
                description: 'The cultural heart of Pakistan, rich in history and modern development.',
                areas: ['DHA Phase 1-9', 'Gulberg', 'Model Town', 'Johar Town', 'Bahria Town'],
                averagePrice: 'Rs 28,000,000',
                image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Lahore',
            },
            {
                city: 'Rawalpindi',
                description: 'A bustling city with a rich history and growing real estate market.',
                areas: ['Bahria Town Rawalpindi', 'DHA Phase 1-5', 'Gulraiz', 'Saddar'],
                averagePrice: 'Rs 20,000,000',
                image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Rawalpindi',
            },
            {
                city: 'Faisalabad',
                description: 'The industrial heart of Pakistan with a growing property market.',
                areas: ['DHA Faisalabad', 'Gulberg', 'Madina Town'],
                averagePrice: 'Rs 15,000,000',
                image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Faisalabad',
            },
            {
                city: 'Multan',
                description: 'A historic city with modern development and affordable living.',
                areas: ['DHA Multan', 'City Housing', 'Gulgasht', 'Bosan Road'],
                averagePrice: 'Rs 12,000,000',
                image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Multan',
            },
        ];

        return res.status(200).json({
            success: true,
            data: areaGuides,
        });
    } catch (error) {
        console.error('Area guides error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// ============================================
// BLOG ROUTES
// ============================================

app.get('/api/blog', async (req, res) => {
    try {
        const { slug, limit = 9 } = req.query;

        let query = supabase
            .from('blogs')
            .select('*, users!author_id(name, email)')
            .order('created_at', { ascending: false });

        if (slug) {
            query = query.eq('slug', slug).single();
        } else {
            query = query.limit(parseInt(limit));
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
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Deal.pk API Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
