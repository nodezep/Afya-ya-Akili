const axios = require('axios');
const supabase = require('../config/supabase');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Africa's Talking SMS
const sendOTP = async (phone, otp) => {
  try {
    // Africa's Talking SMS API
    const response = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      new URLSearchParams({
        username: process.env.AT_USERNAME,
        to: phone,
        message: `BetVision TZ: Your login code is ${otp}. Valid for 10 minutes. Do not share.`,
        from: process.env.AT_SENDER_ID || 'BetVision',
      }),
      {
        headers: {
          'apiKey': process.env.AT_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      }
    );

    console.log(`OTP sent to ${phone}:`, response.data);
    return { success: true };
  } catch (error) {
    console.error('SMS send error:', error.response?.data || error.message);
    // In development, log OTP to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
      return { success: true, dev_otp: otp };
    }
    throw new Error('Failed to send OTP');
  }
};

// Save OTP to database
const saveOTP = async (phone, otp) => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const { error } = await supabase
    .from('otp_logs')
    .insert({
      phone,
      otp_code: otp,
      expires_at: expiresAt.toISOString(),
      purpose: 'LOGIN',
    });

  if (error) throw new Error('Failed to save OTP');
};

// Verify OTP from database
const verifyOTP = async (phone, otp) => {
  const { data, error } = await supabase
    .from('otp_logs')
    .select('*')
    .eq('phone', phone)
    .eq('otp_code', otp)
    .eq('is_used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return false;

  // Mark OTP as used
  await supabase
    .from('otp_logs')
    .update({ is_used: true })
    .eq('id', data.id);

  return true;
};

module.exports = { generateOTP, sendOTP, saveOTP, verifyOTP };
