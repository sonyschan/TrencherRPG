/**
 * idleTrencher Backend Server
 * Express server with Solana wallet tracking and partner management
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { apiLimiter } from './middleware/index.js';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? [
        // Vercel domains (update these after deployment)
        /\.vercel\.app$/,
        // Custom domain (add when configured)
        // 'https://trencher.example.com'
      ]
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Apply global rate limiting in production
if (isProduction) {
  app.use('/api', apiLimiter);
}

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  console.log(`${timestamp} ${req.method} ${req.path} [${ip}]`);
  next();
});

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'idleTrencher API',
    version: '0.1.0',
    environment: isProduction ? 'production' : 'development',
    endpoints: {
      health: 'GET /api/health',
      wallet: 'GET /api/wallet/:address',
      refresh: 'POST /api/wallet/:address/refresh',
      partners: 'GET /api/wallet/:address/partners',
      access: 'GET /api/access/:address',
      history: 'GET /api/wallet/:address/history',
      explore: 'GET /api/explore/:address'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: isProduction ? undefined : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         idleTrencher API Server           ║
  ╠═══════════════════════════════════════════╣
  ║  Status: Running                          ║
  ║  Port: ${PORT}                               ║
  ║  Env: ${(isProduction ? 'production' : 'development').padEnd(27)}║
  ╚═══════════════════════════════════════════╝

  Test endpoints:
  - http://localhost:${PORT}/api/health
  - http://localhost:${PORT}/api/wallet/${process.env.TEST_WALLET_ADDRESS || '52VCnQPmGCYudemRr9m7geyuKd1pRjcAhpVUkhpPwz5G'}
  `);
});
