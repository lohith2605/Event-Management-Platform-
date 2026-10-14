import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requestLogger } from './middlewares/requestLogger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/authRoutes.js';
import eventRouter from './routes/eventRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();

// Development CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Structured HTTP Request Logger
app.use(requestLogger);

// Cookie & Body Parsing
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/events', eventRouter);
app.use('/api/admin', adminRouter);

// Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
