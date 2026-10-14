import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const startServer = async () => {
  try {
    // 1. Establish database connection first
    logger.info('Initializing MongoDB Atlas connection...');
    const conn = await connectDB();

    // 2. Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      // 3. Render clean professional startup banner after confirmed success
      logger.startupBanner({
        appName: 'UTSAV',
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        dbStatus: 'connected',
        dbHost: conn?.connection?.host || 'MongoDB Atlas',
        corsOrigin: CORS_ORIGIN,
      });
    });

    // Handle server startup errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use by another running process.`);
        logger.warn(`Tip: Stop the conflicting process or run: npx kill-port ${PORT}`);
      } else {
        logger.error('Server initialization error:', err);
      }
      process.exit(1);
    });

    // Clean graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.warn(`Received ${signal}. Closing server and database connections...`);
      server.close(async () => {
        try {
          if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
          }
          logger.success('UTSAV Backend shut down gracefully.');
          process.exit(0);
        } catch (error) {
          logger.error('Error during database disconnect:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

startServer();
