const asyncHandler = require('express-async-handler');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];

  // 1. check blacklist
  const blacklisted = await BlacklistedToken.findOne({ token });
  if (blacklisted) {
    res.status(401);
    throw new Error('Token revoked');
  }

  // 2. verify token
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401);
      throw new Error('Invalid token: user not found');
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Invalid token');
  }
});

module.exports = authenticate;
