const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get } = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi' });

  const user = get('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
  if (!user) return res.status(401).json({ error: 'Username atau password salah' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Username atau password salah' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name, rt: user.rt, rw: user.rw },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, name: user.name, rt: user.rt, rw: user.rw }
  });
});

module.exports = router;
