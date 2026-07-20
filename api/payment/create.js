import { supabase, verifyToken } from '../../lib/supabase.js';
import { createRapidPayment } from '../../lib/rapidgateway.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    const { amount, propertyId, type } = req.body;

    if (!amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount is required' 
      });
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        user_id: user.id,
        property_id: propertyId || null,
        amount_rs: amount,
        order_id: orderId,
        type: type || 'premium',
        status: 'pending',
      }])
      .select()
      .single();

    if (paymentError) {
      return res.status(400).json({ 
        success: false, 
        error: paymentError.message 
      });
    }

    // Create RapidGateway payment
    const rapidResponse = await createRapidPayment(
      orderId,
      amount,
      user.email,
      user.user_metadata?.name || 'Customer',
      `${process.env.REDIRECT_URL || 'https://your-domain.com'}/payment/success`
    );

    if (!rapidResponse.paymentUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Payment creation failed' 
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId,
        paymentUrl: rapidResponse.paymentUrl,
        payment,
      },
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
