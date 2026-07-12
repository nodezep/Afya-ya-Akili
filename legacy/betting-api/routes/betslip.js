const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { hasUserUnlocked } = require('../services/payment');

// GET /betslip/today
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: betSlip, error } = await supabase
      .from('bet_slips')
      .select('*')
      .eq('date', today)
      .eq('is_published', true)
      .single();

    if (error || !betSlip) {
      return res.status(404).json({
        success: false,
        message: 'No bet slip available for today'
      });
    }

    // Check if user has unlocked today's slip
    const isUnlocked = await hasUserUnlocked(req.user.id, today);

    if (!isUnlocked) {
      // Return teaser (first match only, no predictions)
      return res.json({
        success: true,
        locked: true,
        bet_slip: {
          id: betSlip.id,
          date: betSlip.date,
          title: betSlip.title,
          total_odds: betSlip.total_odds,
          confidence_level: betSlip.confidence_level,
          match_count: betSlip.matches.length,
          teaser_match: betSlip.matches[0], // Show one match as preview
          unlock_price: 1000,
          currency: 'TZS',
        },
      });
    }

    // Full access
    res.json({
      success: true,
      locked: false,
      bet_slip: betSlip,
    });
  } catch (error) {
    console.error('Today betslip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /betslip/history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get all published slips (past dates)
    const { data: slips, error, count } = await supabase
      .from('bet_slips')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .lt('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get user's unlocked dates
    const { data: unlocks } = await supabase
      .from('user_unlocks')
      .select('bet_slip_date')
      .eq('user_id', req.user.id);

    const unlockedDates = new Set(unlocks?.map(u => u.bet_slip_date) || []);

    // Mark each slip as locked/unlocked for this user
    const slipsWithLockStatus = slips.map(slip => ({
      ...slip,
      is_unlocked: unlockedDates.has(slip.date),
      // Hide predictions if locked
      predictions: unlockedDates.has(slip.date) ? slip.predictions : null,
      matches: unlockedDates.has(slip.date) ? slip.matches : slip.matches?.slice(0, 1),
    }));

    res.json({
      success: true,
      slips: slipsWithLockStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /betslip/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: betSlip, error } = await supabase
      .from('bet_slips')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_published', true)
      .single();

    if (error || !betSlip) {
      return res.status(404).json({ success: false, message: 'Bet slip not found' });
    }

    const isUnlocked = await hasUserUnlocked(req.user.id, betSlip.date);

    res.json({
      success: true,
      locked: !isUnlocked,
      bet_slip: isUnlocked ? betSlip : {
        ...betSlip,
        predictions: null,
        odds: null,
        matches: betSlip.matches?.slice(0, 1),
      },
    });
  } catch (error) {
    console.error('Get betslip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
