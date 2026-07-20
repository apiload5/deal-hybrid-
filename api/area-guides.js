export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      {
        city: 'Peshawar',
        description: 'The gateway to the north, with a rich cultural heritage and growing real estate.',
        areas: ['DHA Peshawar', 'Hayatabad', 'University Town', 'Cantt'],
        averagePrice: 'Rs 18,000,000',
        image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Peshawar',
      },
      {
        city: 'Quetta',
        description: 'The capital of Balochistan, offering affordable living with scenic beauty.',
        areas: ['Cantt', 'Satellite Town', 'Jinnah Town', 'Airport Road'],
        averagePrice: 'Rs 10,000,000',
        image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Quetta',
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
