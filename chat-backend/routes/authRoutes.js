const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Register
// 🔐 Register
router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email already exists' });
  
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, password: hashed });
  
      res.json({ message: 'User registered successfully', user });
    } catch (err) {
      console.error("❌ Registration Error:", err); // 🔍 Add this line
      res.status(500).json({ error: 'Registration failed' });
    }
  });
  
  // 🔓 Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ error: 'Invalid credentials' });
  
      const token = jwt.sign({ userId: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, userId: user.email, name: user.name });
    } catch (err) {
      console.error("❌ Login Error:", err); // 🔍 Add this line
      res.status(500).json({ error: 'Login failed' });
    }
  });
  

module.exports = router;
