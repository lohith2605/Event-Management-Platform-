import jwt from 'jsonwebtoken';

/**
 * Generate signed JWT
 */
export const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );
};

/**
 * Send JWT in HTTP-Only cookie and JSON response
 */
export const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);

  const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '7', 10);
  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name || '',
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
};
