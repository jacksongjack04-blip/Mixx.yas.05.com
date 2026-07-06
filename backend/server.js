const express = require('express');
const cors = require('cors');
const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ===== PORT =====
const PORT = process.env.PORT || 5000;

// ===== TEST ENDPOINTS =====
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Mixx by Yas API is running!',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

app.post('/api/login', (req, res) => {
    console.log('📥 Login request:', req.body);
    const { phone, pin } = req.body;
    
    if (!phone || !pin) {
        return res.status(400).json({
            status: 'error',
            message: 'Phone and PIN are required'
        });
    }
    
    // Generate random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 OTP for ${phone}: ${otp}`);
    
    res.json({
        status: 'success',
        message: 'OTP generated successfully',
        data: {
            phone: phone,
            otp: otp,
            otpSent: true
        }
    });
});

app.post('/api/verify-otp', (req, res) => {
    console.log('📥 Verify OTP request:', req.body);
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
        return res.status(400).json({
            status: 'error',
            message: 'Phone and OTP are required'
        });
    }
    
    // Accept any 6-digit OTP for testing
    if (otp.length === 6) {
        res.json({
            status: 'success',
            message: 'OTP verified successfully!',
            data: {
                phone: phone,
                verified: true
            }
        });
    } else {
        res.status(400).json({
            status: 'error',
            message: 'Invalid OTP. Must be 6 digits'
        });
    }
});

app.post('/api/resend-otp', (req, res) => {
    console.log('📥 Resend OTP request:', req.body);
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({
            status: 'error',
            message: 'Phone is required'
        });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 New OTP for ${phone}: ${otp}`);
    
    res.json({
        status: 'success',
        message: 'New OTP sent successfully!',
        data: {
            phone: phone,
            otp: otp
        }
    });
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 URL: https://mixxbyyas-offers06com-production.up.railway.app`);
});
