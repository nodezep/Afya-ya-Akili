require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// ============================================
// Middleware
// ============================================
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'https://betvision.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api/', limiter);

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Try again later.' },
});
app.use('/auth/login', otpLimiter);
app.use('/auth/register', otpLimiter);

// ============================================
// Routes
// ============================================
app.use('/auth', require('./routes/auth'));
app.use('/betslip', require('./routes/betslip'));
app.use('/payment', require('./routes/payment'));
app.use('/admin', require('./routes/admin'));

// WhatsApp bot webhook
app.use('/bot', require('./routes/bot'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BetVision TZ API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ============================================
// Start Server
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║       BetVision TZ API Server         ║
  ║  Running on port ${PORT}                  ║
  ║  Environment: ${process.env.NODE_ENV || 'development'}           ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
