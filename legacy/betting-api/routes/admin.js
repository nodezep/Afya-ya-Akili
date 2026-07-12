const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// All admin routes require auth + admin
router.use(authMiddleware, adminMiddleware);

// POST /admin/create-betslip
router.post('/create-betslip', async (req, res) => {
  try {
    const {
      date,
      title,
      matches,
      predictions,
      odds,
      total_odds,
      confidence_level,
      is_published = false,
    } = req.body;

    if (!date || !matches || !predictions) {
      return res.status(400).json({
        success: false,
        message: 'Date, matches, and predictions are required'
      });
    }

    // Calculate total odds if not provided
    const calculatedTotalOdds = total_odds ||
      (Array.isArray(odds) ? odds.reduce((acc, o) => acc * o, 1).toFixed(2) : 1.00);

    const { data: betSlip, error } = await supabase
      .from('bet_slips')
      .upsert({
        date,
        title: title || `Bet Slip - ${date}`,
        matches,
        predictions,
        odds,
        total_odds: calculatedTotalOdds,
        confidence_level: confidence_level || 'MEDIUM',
        is_published,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, bet_slip: betSlip });
  } catch (error) {
    console.error('Create betslip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /admin/betslip/:id
router.put('/betslip/:id', async (req, res) => {
  try {
    const { data: betSlip, error } = await supabase
      .from('bet_slips')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, bet_slip: betSlip });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /admin/betslip/:id/publish
router.post('/betslip/:id/publish', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bet_slips')
      .update({ is_published: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Bet slip published', bet_slip: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /admin/betslip/:id/result
router.post('/betslip/:id/result', async (req, res) => {
  try {
    const { result } = req.body;
    if (!['PENDING', 'WIN', 'LOSS', 'VOID'].includes(result)) {
      return res.status(400).json({ success: false, message: 'Invalid result value' });
    }

    const { data, error } = await supabase
      .from('bet_slips')
      .update({ result })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, bet_slip: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /admin/betslips
router.get('/betslips', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bet_slips')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);

    if (error) throw error;
    res.json({ success: true, bet_slips: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [usersCount, paymentsSum, slipsCount, botUsersCount] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('amount').eq('status', 'SUCCESS'),
      supabase.from('bet_slips').select('id', { count: 'exact', head: true }),
      supabase.from('bot_users').select('id', { count: 'exact', head: true }),
    ]);

    const totalRevenue = paymentsSum.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    res.json({
      success: true,
      stats: {
        total_users: usersCount.count || 0,
        total_revenue_tzs: totalRevenue,
        total_bet_slips: slipsCount.count || 0,
        total_bot_users: botUsersCount.count || 0,
        transactions: paymentsSum.data?.length || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, phone, email, full_name, subscription_status, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, users: data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
