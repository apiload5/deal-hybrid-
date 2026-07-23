// index.js - Deal.pk Complete Backend v5.0 with Cloudinary + RapidPaisa
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
// MIDDLEWARE
// ============================================
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' })); // for base64 images
app.use(express.urlencoded({ extended: true }));

// ============================================
// CLOUDINARY CONFIG
// ============================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// SUPABASE CLIENT
// ============================================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    realtime: { transport: ws }
});

// ============================================
// AUTH HELPERS
// ============================================
async function verifyToken(token) {
    try { const { data: { user } = await supabase.auth.getUser(token); return user; }
    catch { return null; }
}
async function getUserRole(userId) {
    const { data } = await supabase.from('users').select('role').eq('id', userId).single();
    return data?.role || 'user';
}
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const user = await verifyToken(token);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid token' });
    req.user = user;
    next();
}
async function adminMiddleware(req, res, next) {
    await authMiddleware(req, res, async () => {
        const role = await getUserRole(req.user.id);
        if (role!== 'admin') return res.status(403).json({ success: false, error: 'Admin access required' });
        next();
    });
}

// ============================================
// CLOUDINARY UPLOAD API
// ============================================
app.post('/api/upload/image', authMiddleware, async (req, res) => {
    try {
        const { image, folder = 'dealpk' } = req.body; // image = base64 string
        if (!image) return res.status(400).json({ success: false, error: 'No image provided' });

        const result = await cloudinary.uploader.upload(image, {
            folder: folder,
            resource_type: 'auto'
        });
        res.json({ success: true, url: result.secure_url, public_id: result.public_id });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/upload/image', authMiddleware, async (req, res) => {
    try {
        const { public_id } = req.body;
        await cloudinary.uploader.destroy(public_id);
        res.json({ success: true, message: 'Image deleted' });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, roleType, agency_id } = req.body;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, phone, role: roleType } });
        if (error) throw error;
        if (data.user) {
            await supabase.from('users').insert([{ id: data.user.id, email, name, phone, role: roleType }]);
            if (roleType === 'agency') await supabase.from('agencies').insert([{ owner_id: data.user.id, name, email, phone, status: 'pending', is_premium: false }]);
            if (roleType === 'builder') await supabase.from('builders').insert([{ owner_id: data.user.id, name, email, phone, status: 'pending', is_premium: false }]);
            if (roleType === 'agent') await supabase.from('agents').insert([{ user_id: data.user.id, agency_id, status: 'pending', is_premium: false }]);
        }
        res.status(201).json({ success: true, message: 'Registration successful!', user: data.user });
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
});
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single();
        res.json({ success: true, user: {...data.user, profile }, session: data.session });
    } catch (error) { res.status(401).json({ success: false, error: error.message }); }
});

// ============================================
// PROFILE ROUTES - USER / AGENCY / BUILDER / AGENT
// ============================================
app.get('/api/user/profile', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    res.json({ success: true, data });
});
app.put('/api/user/profile', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('users').update(req.body).eq('id', req.user.id).select().single();
    res.json({ success: true, data });
});
app.get('/api/agency/:id', async (req, res) => {
    const { data } = await supabase.from('agencies').select('*, users!owner_id(*)').eq('id', req.params.id).single();
    const { data: agents } = await supabase.from('agents').select('*, users!user_id(*)').eq('agency_id', req.params.id);
    res.json({ success: true, data: {...data, agents } });
});
app.put('/api/agency/profile', authMiddleware, async (req, res) => {
    const { data: agency } = await supabase.from('agencies').select('id').eq('owner_id', req.user.id).single();
    const { data } = await supabase.from('agencies').update(req.body).eq('id', agency.id).select().single();
    res.json({ success: true, data });
});
app.get('/api/builder/:id', async (req, res) => {
    const { data } = await supabase.from('builders').select('*, users!owner_id(*)').eq('id', req.params.id).single();
    res.json({ success: true, data });
});
app.put('/api/builder/profile', authMiddleware, async (req, res) => {
    const { data: builder } = await supabase.from('builders').select('id').eq('owner_id', req.user.id).single();
    const { data } = await supabase.from('builders').update(req.body).eq('id', builder.id).select().single();
    res.json({ success: true, data });
});
app.get('/api/agent/:id', async (req, res) => {
    const { data } = await supabase.from('agents').select('*, users!user_id(*), agencies!agency_id(*)').eq('id', req.params.id).single();
    res.json({ success: true, data });
});
app.put('/api/agent/profile', authMiddleware, async (req, res) => {
    const { data: agent } = await supabase.from('agents').select('id').eq('user_id', req.user.id).single();
    const { data } = await supabase.from('agents').update(req.body).eq('id', agent.id).select().single();
    res.json({ success: true, data });
});

// ============================================
// PROPERTIES
// ============================================
app.get('/api/properties', async (req, res) => {
    const { city, type, purpose, minPrice, maxPrice, beds, limit = 20, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = supabase.from('properties').select('*, users!owner_id(id, name, phone)', { count: 'exact' }).eq('status', 'approved');
    if (city) query = query.eq('city', city);
    if (type) query = query.eq('property_type', type);
    if (purpose) query = query.eq('purpose', purpose);
    if (minPrice) query = query.gte('price', minPrice);
    if (maxPrice) query = query.lte('price', maxPrice);
    if (beds) query = query.gte('beds', beds);
    query = query.order('is_premium', { ascending: false }).order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
    const { data, error, count } = await query;
    res.json({ success: true, data, total: count });
});
app.get('/api/properties/:id', async (req, res) => {
    const { data } = await supabase.from('properties').select(`*, users!owner_id(*)`).eq('id', req.params.id).single();
    res.json({ success: true, data });
});
app.post('/api/properties', authMiddleware, async (req, res) => {
    const role = await getUserRole(req.user.id);
    const status = (role === 'agent' || role === 'admin')? 'approved' : 'pending';
    const { data } = await supabase.from('properties').insert([{...req.body, owner_id: req.user.id, status }]).select().single();
    res.status(201).json({ success: true, data });
});
app.post('/api/properties/:id/video', authMiddleware, async (req, res) => {
    const { video_url, video_type } = req.body;
    const { data } = await supabase.from('properties').update({ video_url, video_type }).eq('id', req.params.id).select().single();
    res.json({ success: true, data });
});

// ============================================
// WISHLIST / CITIES / AGENCIES / BUILDERS / PROJECTS / BLOG
// ============================================
app.get('/api/wishlist', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('favorites').select('*, properties!property_id(*)').eq('user_id', req.user.id);
    res.json({ success: true, data: data.map(i => i.properties) });
});
app.post('/api/wishlist', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('favorites').insert([{ user_id: req.user.id, property_id: req.body.propertyId }]).select().single();
    res.json({ success: true, data });
});
app.delete('/api/wishlist', authMiddleware, async (req, res) => {
    await supabase.from('favorites').delete().eq('user_id', req.user.id).eq('property_id', req.body.propertyId);
    res.json({ success: true });
});
app.get('/api/cities', async (req, res) => { const { data } = await supabase.from('cities').select('*, areas!city_id(*)'); res.json({ success: true, data }); });
app.get('/api/agencies', async (req, res) => { const { data } = await supabase.from('agencies').select('*').eq('status', 'active'); res.json({ success: true, data }); });
app.get('/api/builders', async (req, res) => { const { data } = await supabase.from('builders').select('*').eq('status', 'active'); res.json({ success: true, data }); });
app.get('/api/projects', async (req, res) => { const { data } = await supabase.from('projects').select('*, builders!builder_id(*), agencies!agency_id(*)'); res.json({ success: true, data }); });
app.get('/api/blog', async (req, res) => { const { data } = await supabase.from('blogs').select('*').order('created_at', { ascending: false }).limit(9); res.json({ success: true, data }); });
app.get('/api/area-guides', async (req, res) => { const { data } = await supabase.from('area_guides').select('*'); res.json({ success: true, data }); });
app.post('/api/admin/area-guide', adminMiddleware, async (req, res) => { const { data } = await supabase.from('area_guides').insert([req.body]).select().single(); res.json({ success: true, data }); });

// ============================================
// RAPIDPAISA PAYMENT INTEGRATION
// ============================================
const RAPIDPAISA_MERCHANT_ID = process.env.RAPIDPAISA_MERCHANT_ID;
const RAPIDPAISA_SECRET_KEY = process.env.RAPIDPAISA_SECRET_KEY;
const RAPIDPAISA_URL = 'https://app.rapidpaisa.com/api/payment'; // check their docs

app.post('/api/payment/create-premium', authMiddleware, async (req, res) => {
    try {
        const { type, id, duration, amount } = req.body; // amount in PKR
        const order_id = `DEALPK-${Date.now()}`;

        const payload = {
            merchant_id: RAPIDPAISA_MERCHANT_ID,
            order_id: order_id,
            amount: amount,
            currency: 'PKR',
            customer_email: req.user.email,
            customer_name: req.user.user_metadata?.name,
            return_url: `${process.env.FRONTEND_URL}/payment/success`,
            cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
            webhook_url: `${process.env.BACKEND_URL}/api/payment/webhook`
        };

        // Generate signature
        const signature = crypto.createHmac('sha256', RAPIDPAISA_SECRET_KEY).update(JSON.stringify(payload)).digest('hex');

        // Save pending payment
        await supabase.from('payments').insert([{
            order_id, user_id: req.user.id, type, item_id: id, duration, amount, status: 'pending'
        }]);

        res.json({ success: true, payment_url: RAPIDPAISA_URL, payload, signature });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// RapidPaisa Webhook - Payment success hone ke baad ye hit hoga
app.post('/api/payment/webhook', async (req, res) => {
    try {
        const { order_id, status } = req.body;
        if (status === 'success') {
            const { data: payment } = await supabase.from('payments').select('*').eq('order_id', order_id).single();
            if (payment) {
                const table = payment.type + 's';
                const expires = new Date(Date.now() + payment.duration * 24 * 60 * 60 * 1000);
                await supabase.from(table).update({ is_premium: true, premium_expires_at: expires }).eq('id', payment.item_id);
                await supabase.from('payments').update({ status: 'completed' }).eq('order_id', order_id);
            }
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

// ============================================
// ADMIN ROUTES
// ============================================
app.get('/api/admin/dashboard', adminMiddleware, async (req, res) => {
    const [users, properties] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true })
    ]);
    res.json({ success: true, data: { stats: { totalUsers: users.count, totalProperties: properties.count } });
});
app.get('/api/admin/properties/pending', adminMiddleware, async (req, res) => {
    const { data } = await supabase.from('properties').select('*, users!owner_id(name)').eq('status', 'pending');
    res.json({ success: true, data });
});
app.post('/api/admin/property/approve', adminMiddleware, async (req, res) => {
    const { id, action } = req.body;
    const { data } = await supabase.from('properties').update({ status: action === 'approve'? 'approved' : 'rejected' }).eq('id', id).select().single();
    res.json({ success: true, data });
});
app.post('/api/admin/verify', adminMiddleware, async (req, res) => {
    const { type, id, action } = req.body;
    const { data } = await supabase.from(type + 's').update({ status: action === 'verify'? 'active' : 'rejected' }).eq('id', id).select().single();
    res.json({ success: true, data });
});

app.get('/', (req, res) => res.json({ success: true, message: 'Deal.pk API v5.0 Running' }));
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
