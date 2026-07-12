const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone, email, full_name, subscription_status, is_admin')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const adminMiddleware = async (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
