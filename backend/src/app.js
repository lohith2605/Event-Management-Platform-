import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requestLogger } from './middlewares/requestLogger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/authRoutes.js';
import eventRouter from './routes/eventRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import paymentRouter from './routes/paymentRoutes.js';
import ticketRouter from './routes/ticketRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import userRouter from './routes/userRoutes.js';
import organizerRouter from './routes/organizerRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();

// Development CORS configuration supporting both localhost and 127.0.0.1
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
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
app.use('/api/bookings', bookingRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/users', userRouter);
app.use('/api/organizer', organizerRouter);
app.use('/api/chat', chatRouter);

// Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
