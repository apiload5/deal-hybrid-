const RAPID_MERCHANT_ID = process.env.RAPID_MERCHANT_ID;
const RAPID_API_KEY = process.env.RAPID_API_KEY;
const RAPID_SECRET_KEY = process.env.RAPID_SECRET_KEY;

const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.rapidgateway.pk/v1'
  : 'https://sandbox.rapidgateway.pk/v1';

export async function createRapidPayment(orderId, amount, customerEmail, customerName, returnUrl) {
  try {
    const response = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Id': RAPID_MERCHANT_ID,
        'X-API-Key': RAPID_API_KEY,
      },
      body: JSON.stringify({
        merchantId: RAPID_MERCHANT_ID,
        orderId,
        amount,
        currency: 'PKR',
        returnUrl: returnUrl || 'https://your-domain.com/payment/success',
        cancelUrl: 'https://your-domain.com/payment/cancel',
        customerEmail,
        customerName,
        signature: generateSignature(orderId, amount),
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('RapidGateway error:', error);
    throw new Error('Payment creation failed');
  }
}

function generateSignature(orderId, amount) {
  const payload = `${RAPID_MERCHANT_ID}|${orderId}|${amount}|PKR`;
  return Buffer.from(payload + RAPID_SECRET_KEY).toString('base64');
}

export async function verifyRapidPayment(orderId) {
  try {
    const response = await fetch(`${BASE_URL}/payments/${orderId}/verify`, {
      method: 'GET',
      headers: {
        'X-Merchant-Id': RAPID_MERCHANT_ID,
        'X-API-Key': RAPID_API_KEY,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('RapidGateway verify error:', error);
    throw new Error('Payment verification failed');
  }
}
