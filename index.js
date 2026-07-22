// index.js - Complete Backend Server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SUPABASE CLIENT
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// HEALTH CHECK
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Deal.pk API Server Running',
        version: '2.0.0'
    });
});

// ... yahan tumhara pura wala code paste kar do ...

// START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Deal.pk API Server running on port ${PORT}`);
});
