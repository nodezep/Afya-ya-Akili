const axios = require('axios');
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

const SNIPPE_BASE_URL = process.env.SNIPPE_BASE_URL || 'https://api.snippe.com/v1';
const UNLOCK_AMOUNT = 1000; // TZS

// Initiate SnipPay mobile money payment
const initiatePayment = async ({ userId, phone, amount = UNLOCK_AMOUNT, betSlipDate }) => {
  const reference = `BV-${uuidv4().substring(0, 8).toUpperCase()}`;

  try {
    // Create payment record in DB first
    const { data: payment, error: dbError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        currency: 'TZS',
        status: 'PENDING',
        transaction_id: reference,
        phone_used: phone,
        bet_slip_date: betSlipDate,
        payment_method: 'MOBILE_MONEY',
        provider: 'SNIPPE',
      })
      .select()
      .single();

    if (dbError) throw new Error('Failed to create payment record');

    // Call SnipPay API
    const snippeResponse = await axios.post(
      `${SNIPPE_BASE_URL}/payments/initiate`,
      {
        amount,
        currency: 'TZS',
        phone,
        reference,
        description: `BetVision TZ - Daily Predictions Unlock (${betSlipDate})`,
        callback_url: process.env.SNIPPE_CALLBACK_URL,
        metadata: {
          user_id: userId,
          bet_slip_date: betSlipDate,
          payment_id: payment.id,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.SNIPPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Secret': process.env.SNIPPE_SECRET,
        },
        timeout: 30000,
      }
    );

    const { checkout_url, snippe_reference } = snippeResponse.data;

    // Update payment with SnipPay reference
    await supabase
      .from('payments')
      .update({ snippe_reference })
      .eq('id', payment.id);

    return {
      success: true,
      payment_id: payment.id,
      reference,
      checkout_url,
      amount,
    };
  } catch (error) {
    console.error('SnipPay initiation error:', error.response?.data || error.message);

    // Development fallback - simulate payment
    if (process.env.NODE_ENV === 'development') {
      const { data: payment } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount,
          currency: 'TZS',
          status: 'PENDING',
          transaction_id: reference,
          phone_used: phone,
          bet_slip_date: betSlipDate,
          provider: 'SNIPPE',
        })
        .select()
        .single();

      return {
        success: true,
        payment_id: payment?.id,
        reference,
        checkout_url: null,
        amount,
        dev_mode: true,
      };
    }

    throw new Error('Payment initiation failed. Please try again.');
  }
};

// Verify payment status with SnipPay
const verifyPayment = async ({ reference, paymentId }) => {
  try {
    const snippeResponse = await axios.get(
      `${SNIPPE_BASE_URL}/payments/status/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SNIPPE_API_KEY}`,
        },
      }
    );

    const { status, transaction_id } = snippeResponse.data;

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      return await processSuccessfulPayment(paymentId, transaction_id);
    }

    return { success: false, status };
  } catch (error) {
    console.error('SnipPay verify error:', error.response?.data || error.message);

    // Dev mode - auto-approve
    if (process.env.NODE_ENV === 'development') {
      return await processSuccessfulPayment(paymentId, `DEV-${Date.now()}`);
    }

    throw new Error('Payment verification failed');
  }
};

// Handle SnipPay webhook callback
const handleCallback = async (payload) => {
  const { reference, status, transaction_id, metadata } = payload;

  if (status !== 'SUCCESS' && status !== 'COMPLETED') {
    await supabase
      .from('payments')
      .update({ status: 'FAILED' })
      .eq('transaction_id', reference);
    return { processed: false };
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('transaction_id', reference)
    .single();

  if (!payment) return { processed: false };

  return await processSuccessfulPayment(payment.id, transaction_id);
};

// Internal: mark payment success + unlock bet slip for user
const processSuccessfulPayment = async (paymentId, transactionId) => {
  const { data: payment } = await supabase
    .from('payments')
    .update({
      status: 'SUCCESS',
      transaction_id: transactionId || `TXN-${Date.now()}`,
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (!payment) throw new Error('Payment not found');

  // Create user unlock
  await supabase
    .from('user_unlocks')
    .upsert({
      user_id: payment.user_id,
      bet_slip_date: payment.bet_slip_date,
      payment_id: payment.id,
    });

  return {
    success: true,
    status: 'SUCCESS',
    payment_id: payment.id,
    unlocked_date: payment.bet_slip_date,
  };
};

// Check if user has unlocked a specific date
const hasUserUnlocked = async (userId, date) => {
  const { data } = await supabase
    .from('user_unlocks')
    .select('id')
    .eq('user_id', userId)
    .eq('bet_slip_date', date)
    .single();

  return !!data;
};

module.exports = {
  initiatePayment,
  verifyPayment,
  handleCallback,
  hasUserUnlocked,
  UNLOCK_AMOUNT,
};
