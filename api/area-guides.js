import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Static area guides data (can be moved to database)
    const areaGuides = [
      {
        city: 'Islamabad',
        description: 'The capital city of Pakistan, known for its beautiful landscapes and modern infrastructure.',
        areas: ['DHA Phase 1-8', 'Bahria Town', 'F-6', 'F-7', 'F-8', 'G-10', 'Blue Area'],
        averagePrice: 'Rs 35,000,000',
      },
      {
        city: 'Karachi',
        description: 'The economic hub of Pakistan, offering diverse property options for all budgets.',
        areas: ['DHA Phase 1-8', 'Clifton', 'Defence View', 'Bahria Town Karachi'],
        averagePrice: 'Rs 25,000,000',
      },
      {
        city: 'Lahore',
        description: 'The cultural heart of Pakistan, rich in history and modern development.',
        areas: ['DHA Phase 1-9', 'Gulberg', 'Model Town', 'Johar Town', 'Bahria Town'],
        averagePrice: 'Rs 28,000,000',
      },
      {
        city: 'Rawalpindi',
        description: 'A bustling city with a rich history and growing real estate market.',
        areas: ['Bahria Town Rawalpindi', 'DHA Phase 1-5', 'Gulraiz', 'Saddar'],
        averagePrice: 'Rs 20,000,000',
      },
      {
        city: 'Faisalabad',
        description: 'The industrial heart of Pakistan with a growing property market.',
        areas: ['DHA Faisalabad', 'Gulberg', 'Madina Town'],
        averagePrice: 'Rs 15,000,000',
      },
      {
        city: 'Multan',
        description: 'A historic city with modern development and affordable living.',
        areas: ['DHA Multan', 'City Housing', 'Gulgasht', 'Bosan Road'],
        averagePrice: 'Rs 12,000,000',
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
}
