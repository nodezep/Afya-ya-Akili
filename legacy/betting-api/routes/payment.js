const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { initiatePayment, verifyPayment, handleCallback, hasUserUnlocked, UNLOCK_AMOUNT } = require('../services/payment');

// POST /payment/create
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { phone, bet_slip_date } = req.body;
    const date = bet_slip_date || new Date().toISOString().split('T')[0];

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required for payment' });
    }

    // Check if already unlocked
    const alreadyUnlocked = await hasUserUnlocked(req.user.id, date);
    if (alreadyUnlocked) {
      return res.status(409).json({
        success: false,
        message: 'You have already unlocked this bet slip',
      });
    }

    const result = await initiatePayment({
      userId: req.user.id,
      phone,
      amount: UNLOCK_AMOUNT,
      betSlipDate: date,
    });

    res.json(result);
  } catch (error) {
    console.error('Payment create error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /payment/verify
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { reference, payment_id } = req.body;

    if (!reference && !payment_id) {
      return res.status(400).json({ success: false, message: 'Reference or payment_id required' });
    }

    const result = await verifyPayment({ reference, paymentId: payment_id });
    res.json(result);
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /payment/callback (SnipPay webhook)
router.post('/callback', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-snippe-signature'];
    // TODO: Validate HMAC signature here in production

    const result = await handleCallback(req.body);
    res.json({ received: true, ...result });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /payment/status/:reference
router.get('/status/:reference', authMiddleware, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', req.params.reference)
      .eq('user_id', req.user.id)
      .single();

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /payment/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
