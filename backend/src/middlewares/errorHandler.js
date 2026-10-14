import logger from '../utils/logger.js';

export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || (res.statusCode >= 400 ? res.statusCode : 500);

  // If server-side 5xx unexpected error, log full error stack for debugging
  if (statusCode >= 500) {
    logger.error(
      `Unhandled Exception on ${req.method} ${req.originalUrl}: ${err.message || 'Unknown Server Error'}`,
      err
    );
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
};
