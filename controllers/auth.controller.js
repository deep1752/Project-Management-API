const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const { signupSchema, loginSchema } = require('../validations/auth.validation');
const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/BlacklistedToken');



const signup = asyncHandler(async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  const { name, email, password, role } = value; // role destructure kiya

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409);
    throw new Error('Email already registered');
  }

  // create user -> pre('save') will hash password
  const user = new User({ name, email, password, role }); 
  await user.save();

  res.status(201).json({
    message: 'User registered successfully',
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    }
  });
});








const login = asyncHandler(async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  const { email, password } = value;
  const user = await User.findOne({ email });
  if (!user) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const match = await user.comparePassword(password);
  if (!match) {
    res.status(401);
    throw new Error('Invalid credentials');
  }

  const token = signToken({ id: user._id });

  res.json({
    message: 'Login successful',
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    token
  });
});








const logout = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(400);
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.decode(token);

  if (!decoded || !decoded.exp) {
    res.status(400);
    throw new Error('Invalid token');
  }

  const expiresAt = new Date(decoded.exp * 1000);

  await BlacklistedToken.updateOne(
    { token },
    { token, expiresAt },
    { upsert: true }
  );

  res.json({ message: 'Successfully logged out (token revoked)' });
});

module.exports = { signup, login, logout };
