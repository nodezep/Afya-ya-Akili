const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const supabase = require('../config/supabase');
const { generateOTP, sendOTP, saveOTP, verifyOTP } = require('../services/sms');

// Normalize phone number to +255 format
const normalizePhone = (phone) => {
  const cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+255')) return cleaned;
  if (cleaned.startsWith('255')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+255${cleaned.substring(1)}`;
  return `+255${cleaned}`;
};

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { phone, email, full_name } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    const normalizedPhone = normalizePhone(phone);

    // Validate Tanzanian phone number
    const tzRegex = /^\+255[67]\d{8}$/;
    if (!tzRegex.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Tanzanian phone number (07xx or 06xx)'
      });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', normalizedPhone)
      .single();

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Phone number already registered' });
    }

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({ phone: normalizedPhone, email, full_name })
      .select()
      .single();

    if (error) throw error;

    // Send OTP
    const otp = generateOTP();
    await saveOTP(normalizedPhone, otp);
    const smsResult = await sendOTP(normalizedPhone, otp);

    res.status(201).json({
      success: true,
      message: 'Registration successful. OTP sent.',
      user_id: user.id,
      ...(smsResult.dev_otp && { dev_otp: smsResult.dev_otp }),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    const normalizedPhone = normalizePhone(phone);

    // Check if user exists, create if not (auto-register on login)
    let { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', normalizedPhone)
      .single();

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ phone: normalizedPhone })
        .select()
        .single();

      if (error) throw error;
      user = newUser;
    }

    // Generate & send OTP
    const otp = generateOTP();
    await saveOTP(normalizedPhone, otp);
    const smsResult = await sendOTP(normalizedPhone, otp);

    res.json({
      success: true,
      message: 'OTP sent to your phone',
      ...(smsResult.dev_otp && { dev_otp: smsResult.dev_otp }),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    }

    const normalizedPhone = normalizePhone(phone);
    const isValid = await verifyOTP(normalizedPhone, otp);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone, email, full_name, subscription_status, is_admin')
      .eq('phone', normalizedPhone)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        full_name: user.full_name,
        subscription_status: user.subscription_status,
        is_admin: user.is_admin,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /auth/me
router.get('/me', require('../middleware/auth').authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
