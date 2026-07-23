// index.js - Deal.pk Complete Backend v6.0 with Full Routes & CORS
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// CORS CONFIGURATION - ONLY ALLOW SPECIFIC URLS
// ============================================
const allowedOrigins = [
    'https://deal-front.onrender.com',
    'https://deal-hybrid.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5500',
    'https://deal.pk',
    'https://www.deal.pk'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(null, true); // Allow all for testing, but restrict in production
            // callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// CLOUDINARY CONFIG
// ============================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
    api_key: process.env.CLOUDINARY_API_KEY || 'demo',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'demo'
});

// ============================================
// SUPABASE CLIENT
// ============================================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: ws } }
);

// ============================================
// AUTH HELPERS
// ============================================
async function verifyToken(token) {
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Token verification error:', error.message);
        return null;
    }
}

async function getUserRole(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data?.role || 'user';
    } catch (error) {
        console.error('Get user role error:', error.message);
        return 'user';
    }
}

async function getUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get user profile error:', error.message);
        return null;
    }
}

// ============================================
// AUTH MIDDLEWARE
// ============================================
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized - No token provided' });
    }
    const user = await verifyToken(token);
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized - Invalid token' });
    }
    req.user = user;
    req.userId = user.id;
    next();
}

async function adminMiddleware(req, res, next) {
    await authMiddleware(req, res, async () => {
        const role = await getUserRole(req.user.id);
        if (role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        next();
    });
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Deal.pk API v6.0 Running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// CLOUDINARY UPLOAD API
// ============================================
app.post('/api/upload/image', authMiddleware, async (req, res) => {
    try {
        const { image, folder = 'dealpk' } = req.body;
        if (!image) {
            return res.status(400).json({ success: false, error: 'No image provided' });
        }

        const result = await cloudinary.uploader.upload(image, {
            folder: folder,
            resource_type: 'auto',
            transformation: [{ quality: 'auto' }]
        });
        
        res.json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/upload/image', authMiddleware, async (req, res) => {
    try {
        const { public_id } = req.body;
        if (!public_id) {
            return res.status(400).json({ success: false, error: 'No public_id provided' });
        }
        
        const result = await cloudinary.uploader.destroy(public_id);
        res.json({ success: true, message: 'Image deleted', result });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, roleType = 'user', agency_id } = req.body;

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email, password, and name are required' 
            });
        }

        // Register user with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, phone, role: roleType }
            }
        });

        if (error) throw error;

        if (data.user) {
            // Create user profile in users table
            const { error: profileError } = await supabase
                .from('users')
                .insert([{
                    id: data.user.id,
                    email,
                    name,
                    phone,
                    role: roleType
                }]);

            if (profileError) {
                console.error('Profile creation error:', profileError);
                // Don't throw, user is created but profile failed
            }

            // Create role-specific entries
            if (roleType === 'agency') {
                await supabase
                    .from('agencies')
                    .insert([{
                        owner_id: data.user.id,
                        name: name,
                        email: email,
                        phone: phone,
                        status: 'pending',
                        is_premium: false
                    }]);
            }

            if (roleType === 'builder') {
                await supabase
                    .from('builders')
                    .insert([{
                        owner_id: data.user.id,
                        name: name,
                        email: email,
                        phone: phone,
                        status: 'pending',
                        is_premium: false
                    }]);
            }

            if (roleType === 'agent' && agency_id) {
                await supabase
                    .from('agents')
                    .insert([{
                        user_id: data.user.id,
                        agency_id: agency_id,
                        status: 'pending',
                        is_premium: false
                    }]);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.',
            user: data.user
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

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
            password
        });

        if (error) throw error;

        // Get user profile
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        res.json({
            success: true,
            user: { ...data.user, profile },
            session: data.session
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
    try {
        await supabase.auth.signOut();
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL || 'https://deal-front.onrender.com'}/reset-password`
        });

        if (error) throw error;

        res.json({
            success: true,
            message: 'Password reset email sent! Please check your inbox.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ============================================
// USER PROFILE ROUTES
// ============================================
app.get('/api/user/profile', authMiddleware, async (req, res) => {
    try {
        const profile = await getUserProfile(req.user.id);
        if (!profile) {
            // Create profile if it doesn't exist
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    id: req.user.id,
                    email: req.user.email,
                    name: req.user.user_metadata?.name || 'User',
                    role: req.user.user_metadata?.role || 'user'
                }])
                .select()
                .single();

            if (error) throw error;
            return res.json({ success: true, data });
        }
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
    try {
        const { name, phone, avatar_url, bio } = req.body;

        // Update user metadata in auth
        await supabase.auth.updateUser({
            data: { name }
        });

        // Update user profile
        const { data, error } = await supabase
            .from('users')
            .update({
                name,
                phone,
                avatar_url,
                bio,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// AGENCY ROUTES
// ============================================
app.get('/api/agencies', async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('agencies')
            .select('*, users!owner_id(name, email, phone)', { count: 'exact' })
            .eq('status', 'active')
            .order('is_premium', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({ success: true, data, total: count });
    } catch (error) {
        console.error('Get agencies error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/agencies/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agencies')
            .select('*, users!owner_id(*)')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // Get agents for this agency
        const { data: agents } = await supabase
            .from('agents')
            .select('*, users!user_id(*)')
            .eq('agency_id', req.params.id);

        // Get properties for this agency
        const { data: properties } = await supabase
            .from('properties')
            .select('*')
            .eq('agency_id', req.params.id)
            .eq('status', 'approved')
            .limit(10);

        res.json({
            success: true,
            data: { ...data, agents: agents || [], properties: properties || [] }
        });
    } catch (error) {
        console.error('Get agency error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agencies', authMiddleware, async (req, res) => {
    try {
        const role = await getUserRole(req.user.id);
        if (role !== 'admin' && role !== 'agency') {
            return res.status(403).json({ success: false, error: 'Not authorized to create agency' });
        }

        const { data, error } = await supabase
            .from('agencies')
            .insert([{
                ...req.body,
                owner_id: req.user.id,
                status: role === 'admin' ? 'active' : 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create agency error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/agencies/:id', authMiddleware, async (req, res) => {
    try {
        const { data: agency } = await supabase
            .from('agencies')
            .select('owner_id')
            .eq('id', req.params.id)
            .single();

        if (!agency) {
            return res.status(404).json({ success: false, error: 'Agency not found' });
        }

        const role = await getUserRole(req.user.id);
        if (agency.owner_id !== req.user.id && role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to update this agency' });
        }

        const { data, error } = await supabase
            .from('agencies')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update agency error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// BUILDER ROUTES
// ============================================
app.get('/api/builders', async (req, res) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('builders')
            .select('*, users!owner_id(name, email, phone)', { count: 'exact' })
            .eq('status', 'active')
            .order('is_premium', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({ success: true, data, total: count });
    } catch (error) {
        console.error('Get builders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/builders/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('builders')
            .select('*, users!owner_id(*)')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // Get projects for this builder
        const { data: projects } = await supabase
            .from('projects')
            .select('*')
            .eq('builder_id', req.params.id)
            .limit(10);

        res.json({
            success: true,
            data: { ...data, projects: projects || [] }
        });
    } catch (error) {
        console.error('Get builder error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/builders', authMiddleware, async (req, res) => {
    try {
        const role = await getUserRole(req.user.id);
        if (role !== 'admin' && role !== 'builder') {
            return res.status(403).json({ success: false, error: 'Not authorized to create builder' });
        }

        const { data, error } = await supabase
            .from('builders')
            .insert([{
                ...req.body,
                owner_id: req.user.id,
                status: role === 'admin' ? 'active' : 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create builder error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/builders/:id', authMiddleware, async (req, res) => {
    try {
        const { data: builder } = await supabase
            .from('builders')
            .select('owner_id')
            .eq('id', req.params.id)
            .single();

        if (!builder) {
            return res.status(404).json({ success: false, error: 'Builder not found' });
        }

        const role = await getUserRole(req.user.id);
        if (builder.owner_id !== req.user.id && role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to update this builder' });
        }

        const { data, error } = await supabase
            .from('builders')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update builder error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PROPERTIES ROUTES (COMPLETE)
// ============================================
app.get('/api/properties', async (req, res) => {
    try {
        const {
            city,
            area,
            type,
            purpose,
            minPrice,
            maxPrice,
            beds,
            baths,
            minArea,
            maxArea,
            furnished,
            isPremium,
            isFeatured,
            owner_id,
            agency_id,
            limit = 12,
            page = 1,
            featured
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('properties')
            .select('*, users!owner_id(id, name, email, phone), agencies!agency_id(id, name)', { count: 'exact' })
            .eq('status', 'approved');

        // Apply filters
        if (city) query = query.eq('city', city);
        if (area) query = query.eq('area', area);
        if (type) query = query.eq('property_type', type);
        if (purpose) query = query.eq('purpose', purpose);
        if (minPrice) query = query.gte('price', parseFloat(minPrice));
        if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
        if (beds) query = query.gte('beds', parseInt(beds));
        if (baths) query = query.gte('baths', parseInt(baths));
        if (minArea) query = query.gte('area_sqft', parseFloat(minArea));
        if (maxArea) query = query.lte('area_sqft', parseFloat(maxArea));
        if (furnished) query = query.eq('furnished', furnished);
        if (isPremium === 'true') query = query.eq('is_premium', true);
        if (isFeatured === 'true') query = query.eq('is_featured', true);
        if (featured === 'true') query = query.eq('is_featured', true);
        if (owner_id) query = query.eq('owner_id', owner_id);
        if (agency_id) query = query.eq('agency_id', agency_id);

        // Sorting
        query = query
            .order('is_premium', { ascending: false })
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            success: true,
            data: data || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/properties/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*, users!owner_id(*), agencies!agency_id(*, users!owner_id(*))')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, error: 'Property not found' });
            }
            throw error;
        }

        // Increment view count
        await supabase
            .from('properties')
            .update({ views: (data.views || 0) + 1 })
            .eq('id', req.params.id);

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get property error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/properties', authMiddleware, async (req, res) => {
    try {
        const role = await getUserRole(req.user.id);
        const status = (role === 'admin' || role === 'agency') ? 'approved' : 'pending';

        const propertyData = {
            ...req.body,
            owner_id: req.user.id,
            status: status,
            views: 0,
            is_premium: req.body.is_premium || false,
            is_featured: req.body.is_featured || false
        };

        const { data, error } = await supabase
            .from('properties')
            .insert([propertyData])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data,
            message: status === 'approved' ? 'Property listed successfully!' : 'Property submitted for approval.'
        });
    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/properties/:id', authMiddleware, async (req, res) => {
    try {
        // Check ownership
        const { data: existing } = await supabase
            .from('properties')
            .select('owner_id, status')
            .eq('id', req.params.id)
            .single();

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const role = await getUserRole(req.user.id);
        if (existing.owner_id !== req.user.id && role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to update this property' });
        }

        // If admin is updating, allow status change
        const updateData = { ...req.body };
        if (role === 'admin' && req.body.status) {
            updateData.status = req.body.status;
        } else {
            delete updateData.status; // Don't allow non-admin to change status
        }

        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update property error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/properties/:id', authMiddleware, async (req, res) => {
    try {
        const { data: existing } = await supabase
            .from('properties')
            .select('owner_id')
            .eq('id', req.params.id)
            .single();

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const role = await getUserRole(req.user.id);
        if (existing.owner_id !== req.user.id && role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this property' });
        }

        const { error } = await supabase
            .from('properties')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true, message: 'Property deleted successfully' });
    } catch (error) {
        console.error('Delete property error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PROPERTY VIDEO ROUTE
// ============================================
app.post('/api/properties/:id/video', authMiddleware, async (req, res) => {
    try {
        const { video_url, video_type = 'youtube' } = req.body;

        if (!video_url) {
            return res.status(400).json({ success: false, error: 'Video URL is required' });
        }

        const { data, error } = await supabase
            .from('properties')
            .update({
                video_url,
                video_type,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Add video error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PROPERTY IMAGES ROUTE (Add/Remove)
// ============================================
app.post('/api/properties/:id/images', authMiddleware, async (req, res) => {
    try {
        const { images } = req.body;
        if (!images || !Array.isArray(images)) {
            return res.status(400).json({ success: false, error: 'Images array is required' });
        }

        const { data, error } = await supabase
            .from('properties')
            .update({
                images: images,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update images error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// CITIES & AREAS ROUTES
// ============================================
app.get('/api/cities', async (req, res) => {
    try {
        // Get all cities with area counts
        const { data, error } = await supabase
            .from('cities')
            .select('*, areas!city_id(id, name, total_properties)')
            .order('name');

        if (error) throw error;

        // Get property count per city
        const cityStats = await Promise.all((data || []).map(async (city) => {
            const { count } = await supabase
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('city', city.name)
                .eq('status', 'approved');
            
            return { ...city, total_properties: count || 0 };
        }));

        res.json({ success: true, data: cityStats });
    } catch (error) {
        console.error('Get cities error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/cities/:id/areas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('areas')
            .select('*, properties_count')
            .eq('city_id', req.params.id)
            .order('name');

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get areas error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/areas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('areas')
            .select('*, cities!city_id(name)')
            .order('name');

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get all areas error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PROPERTIES NEARBY
// ============================================
app.get('/api/properties/nearby', async (req, res) => {
    try {
        const { lat, lng, radius = 10, limit = 20 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ 
                success: false, 
                error: 'Latitude and longitude are required' 
            });
        }

        // For now, return all approved properties with city filter
        // In production, use PostGIS with Supabase for actual distance calculation
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('status', 'approved')
            .limit(parseInt(limit));

        if (error) throw error;

        // Simple distance calculation (if coordinates are stored in property)
        // You can add lat/lng to properties table for better nearby search
        res.json({
            success: true,
            data: data || [],
            total: data?.length || 0,
            location: { lat: parseFloat(lat), lng: parseFloat(lng), radius: parseFloat(radius) }
        });
    } catch (error) {
        console.error('Nearby properties error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PROJECTS ROUTES
// ============================================
app.get('/api/projects', async (req, res) => {
    try {
        const { limit = 20, page = 1, builder_id, city } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('projects')
            .select('*, builders!builder_id(*), agencies!agency_id(*)', { count: 'exact' })
            .eq('status', 'active')
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (builder_id) query = query.eq('builder_id', builder_id);
        if (city) query = query.eq('city', city);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({ success: true, data, total: count });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*, builders!builder_id(*), agencies!agency_id(*)')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, error: 'Project not found' });
            }
            throw error;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/projects', authMiddleware, async (req, res) => {
    try {
        const role = await getUserRole(req.user.id);
        if (role !== 'admin' && role !== 'builder') {
            return res.status(403).json({ success: false, error: 'Not authorized to create project' });
        }

        const { data, error } = await supabase
            .from('projects')
            .insert([{
                ...req.body,
                status: role === 'admin' ? 'active' : 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
    try {
        const role = await getUserRole(req.user.id);
        if (role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        const { data, error } = await supabase
            .from('projects')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// BLOG ROUTES
// ============================================
app.get('/api/blog', async (req, res) => {
    try {
        const { limit = 9, page = 1, slug } = req.query;

        if (slug) {
            const { data, error } = await supabase
                .from('blogs')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json({ success: false, error: 'Blog post not found' });
                }
                throw error;
            }

            return res.json({ success: true, data });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { data, error, count } = await supabase
            .from('blogs')
            .select('*', { count: 'exact' })
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (error) throw error;
        res.json({ success: true, data, total: count });
    } catch (error) {
        console.error('Get blog error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/blog', adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blogs')
            .insert([{
                ...req.body,
                author_id: req.user.id,
                status: 'published'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/blog/:id', adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blogs')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update blog error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/blog/:id', adminMiddleware, async (req, res) => {
    try {
        const { error } = await supabase
            .from('blogs')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true, message: 'Blog post deleted successfully' });
    } catch (error) {
        console.error('Delete blog error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// AREA GUIDES ROUTES
// ============================================
app.get('/api/area-guides', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('area_guides')
            .select('*')
            .order('city');

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get area guides error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/area-guides', adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('area_guides')
            .insert([req.body])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create area guide error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/area-guides/:id', adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('area_guides')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Update area guide error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// WISHLIST / FAVORITES ROUTES
// ============================================
app.get('/api/wishlist', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('*, properties!property_id(*)')
            .eq('user_id', req.user.id);

        if (error) throw error;

        const properties = (data || [])
            .map(item => item.properties)
            .filter(p => p !== null);

        res.json({ success: true, data: properties });
    } catch (error) {
        console.error('Get wishlist error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/wishlist', authMiddleware, async (req, res) => {
    try {
        const { propertyId } = req.body;
        if (!propertyId) {
            return res.status(400).json({ success: false, error: 'Property ID is required' });
        }

        // Check if already exists
        const { data: existing } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('property_id', propertyId)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ success: false, error: 'Already in wishlist' });
        }

        const { data, error } = await supabase
            .from('favorites')
            .insert([{
                user_id: req.user.id,
                property_id: propertyId
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Add wishlist error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/wishlist', authMiddleware, async (req, res) => {
    try {
        const { propertyId } = req.body;
        if (!propertyId) {
            return res.status(400).json({ success: false, error: 'Property ID is required' });
        }

        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', req.user.id)
            .eq('property_id', propertyId);

        if (error) throw error;
        res.json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        console.error('Remove wishlist error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// INQUIRIES ROUTES
// ============================================
app.post('/api/inquiries', authMiddleware, async (req, res) => {
    try {
        const { property_id, message } = req.body;
        if (!property_id) {
            return res.status(400).json({ success: false, error: 'Property ID is required' });
        }

        const { data, error } = await supabase
            .from('inquiries')
            .insert([{
                property_id,
                user_id: req.user.id,
                message,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Create inquiry error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/inquiries', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('inquiries')
            .select('*, properties!property_id(*), users!user_id(*)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get inquiries error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// AGENTS ROUTES
// ============================================
app.get('/api/agents', async (req, res) => {
    try {
        const { agency_id, limit = 20, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('agents')
            .select('*, users!user_id(*), agencies!agency_id(*)', { count: 'exact' })
            .eq('status', 'active')
            .range(offset, offset + parseInt(limit) - 1);

        if (agency_id) query = query.eq('agency_id', agency_id);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({ success: true, data, total: count });
    } catch (error) {
        console.error('Get agents error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/agents/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agents')
            .select('*, users!user_id(*), agencies!agency_id(*)')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, error: 'Agent not found' });
            }
            throw error;
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Get agent error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PAYMENT / PREMIUM ROUTES
// ============================================
const RAPIDPAISA_MERCHANT_ID = process.env.RAPIDPAISA_MERCHANT_ID;
const RAPIDPAISA_SECRET_KEY = process.env.RAPIDPAISA_SECRET_KEY;
const RAPIDPAISA_URL = process.env.RAPIDPAISA_URL || 'https://app.rapidpaisa.com/api/payment';

app.post('/api/payment/create-premium', authMiddleware, async (req, res) => {
    try {
        const { type, id, duration, amount } = req.body;
        
        if (!type || !id || !duration || !amount) {
            return res.status(400).json({
                success: false,
                error: 'type, id, duration, and amount are required'
            });
        }

        const order_id = `DEALPK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const payload = {
            merchant_id: RAPIDPAISA_MERCHANT_ID,
            order_id: order_id,
            amount: amount,
            currency: 'PKR',
            customer_email: req.user.email,
            customer_name: req.user.user_metadata?.name || 'Customer',
            return_url: `${process.env.FRONTEND_URL || 'https://deal-front.onrender.com'}/payment/success`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://deal-front.onrender.com'}/payment/cancel`,
            webhook_url: `${process.env.BACKEND_URL || 'https://deal-hybrid.vercel.app'}/api/payment/webhook`
        };

        // Generate signature
        const signature = crypto
            .createHmac('sha256', RAPIDPAISA_SECRET_KEY)
            .update(JSON.stringify(payload))
            .digest('hex');

        // Save pending payment
        await supabase.from('payments').insert([{
            order_id,
            user_id: req.user.id,
            type,
            item_id: id,
            duration,
            amount,
            status: 'pending'
        }]);

        res.json({
            success: true,
            payment_url: RAPIDPAISA_URL,
            payload,
            signature,
            order_id
        });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/payment/webhook', async (req, res) => {
    try {
        const { order_id, status, transaction_id } = req.body;

        if (!order_id) {
            return res.status(400).json({ success: false, error: 'order_id is required' });
        }

        // Get payment record
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', order_id)
            .single();

        if (paymentError || !payment) {
            console.error('Payment not found:', order_id);
            return res.status(404).json({ success: false, error: 'Payment not found' });
        }

        if (status === 'success') {
            // Update the item to premium
            const table = payment.type + 's';
            const expires = new Date(Date.now() + payment.duration * 24 * 60 * 60 * 1000);

            await supabase
                .from(table)
                .update({
                    is_premium: true,
                    premium_expires_at: expires.toISOString()
                })
                .eq('id', payment.item_id);

            // Update payment status
            await supabase
                .from('payments')
                .update({
                    status: 'completed',
                    transaction_id,
                    completed_at: new Date().toISOString()
                })
                .eq('order_id', order_id);

            console.log(`Payment completed: ${order_id}`);
        } else {
            await supabase
                .from('payments')
                .update({
                    status: 'failed',
                    transaction_id,
                    completed_at: new Date().toISOString()
                })
                .eq('order_id', order_id);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================
app.get('/api/admin/dashboard', adminMiddleware, async (req, res) => {
    try {
        // Get all stats in parallel
        const [
            usersCount,
            propertiesCount,
            agenciesCount,
            buildersCount,
            projectsCount,
            pendingProperties,
            blogsCount,
            inquiriesCount
        ] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
            supabase.from('agencies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('builders').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('blogs').select('*', { count: 'exact', head: true }),
            supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'pending')
        ]);

        res.json({
            success: true,
            data: {
                stats: {
                    totalUsers: usersCount.count || 0,
                    totalProperties: propertiesCount.count || 0,
                    totalAgencies: agenciesCount.count || 0,
                    totalBuilders: buildersCount.count || 0,
                    totalProjects: projectsCount.count || 0,
                    pendingProperties: pendingProperties.count || 0,
                    totalBlogs: blogsCount.count || 0,
                    pendingInquiries: inquiriesCount.count || 0
                }
            }
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/properties/pending', adminMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*, users!owner_id(id, name, email, phone)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Get pending properties error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/property/approve', adminMiddleware, async (req, res) => {
    try {
        const { id, action } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Property ID is required' });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        const { data, error } = await supabase
            .from('properties')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({
            success: true,
            data,
            message: `Property ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        console.error('Approve property error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/verify', adminMiddleware, async (req, res) => {
    try {
        const { type, id, action } = req.body;
        if (!type || !id) {
            return res.status(400).json({ success: false, error: 'type and id are required' });
        }

        const newStatus = action === 'verify' ? 'active' : 'rejected';
        const table = type + 's';

        const { data, error } = await supabase
            .from(table)
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({
            success: true,
            data,
            message: `${type} ${action === 'verify' ? 'verified' : 'rejected'} successfully`
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// 404 HANDLER
// ============================================
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`
    });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Deal.pk API v6.0 running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Allowed Origins: ${allowedOrigins.join(', ')}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
