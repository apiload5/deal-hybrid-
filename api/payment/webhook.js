import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, status, amount, transactionId } = req.body;

    if (!orderId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order ID is required' 
      });
    }

    // Update payment status
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .update({
        status: status === 'success' ? 'completed' : 'failed',
        rapid_status: status,
        transaction_id: transactionId,
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (paymentError) {
      return res.status(400).json({ 
        success: false, 
        error: paymentError.message 
      });
    }

    // If payment is successful and it's for a property
    if (status === 'success' && payment.property_id) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase
        .from('properties')
        .update({
          is_premium: payment.type === 'premium',
          is_featured: payment.type === 'featured',
          premium_until: expiresAt.toISOString(),
        })
        .eq('id', payment.property_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}
