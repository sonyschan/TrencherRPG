/**
 * Rate Limiting Middleware
 * Prevents API abuse with per-IP request limits
 */

import rateLimit from 'express-rate-limit';

// Standard API rate limiter: 60 requests per minute per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: 60,              // 60 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,  // Return rate limit info in headers
  legacyHeaders: false,
  // Use X-Forwarded-For header when behind proxy (Vercel/Cloud Run)
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip;
  }
});

// Stricter rate limiter for write operations: 10 requests per minute
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: 10,              // 10 requests per window
  message: { error: 'Too many write requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.ip;
  }
});
