const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const User = require('../models/User');

const router = express.Router();

function isValidEmail(email) {
  const atIndex = email.indexOf('@');
  const lastDotIndex = email.lastIndexOf('.');

  return atIndex > 0 &&
    atIndex === email.lastIndexOf('@') &&
    lastDotIndex > atIndex + 1 &&
    lastDotIndex < email.length - 1 &&
    !/\s/.test(email);
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    watchlist: user.watchlist,
  };
}

function getSessionToken(req) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Name is required.' });
  }

  if (typeof email !== 'string' || !isValidEmail(email.trim())) {
    return res.status(400).json({ message: 'A valid email is required.' });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: 'Registration successful.',
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Could not register user.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || !isValidEmail(email.trim())) {
    return res.status(400).json({ message: 'A valid email is required.' });
  }

  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Password is required.' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.sessionTokenHash = hashSessionToken(token);
    await user.save();

    return res.json({
      message: 'Login successful.',
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Could not log in.' });
  }
});

router.post('/logout', async (req, res) => {
  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  try {
    const user = await User.findOne({ sessionTokenHash: hashSessionToken(token) });
    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or expired.' });
    }

    user.sessionTokenHash = null;
    await user.save();
    return res.json({ message: 'Logout successful.' });
  } catch (error) {
    console.error('Logout failed:', error.message);
    return res.status(500).json({ message: 'Could not log out.' });
  }
});

router.post('/watchlist', async (req, res) => {
  const { userId, movie } = req.body || {};

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: 'A valid user ID is required.' });
  }

  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  if (
    !movie ||
    typeof movie.id !== 'string' ||
    !/^tt\d+$/.test(movie.id) ||
    typeof movie.title !== 'string' ||
    !movie.title.trim()
  ) {
    return res.status(400).json({ message: 'Valid movie information is required.' });
  }

  try {
    const user = await User.findOne({ _id: userId, sessionTokenHash: hashSessionToken(token) });
    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or does not match this user.' });
    }

    if (user.watchlist.some((savedMovie) => savedMovie.id === movie.id)) {
      return res.json({ message: 'Movie is already in your watchlist.' });
    }

    user.watchlist.push({
      id: movie.id,
      title: movie.title.trim(),
      poster: typeof movie.poster === 'string' ? movie.poster : null,
      overview: typeof movie.overview === 'string' ? movie.overview : '',
      releaseDate: typeof movie.releaseDate === 'string' ? movie.releaseDate : '',
      rating: typeof movie.rating === 'number' ? movie.rating : null,
    });
    await user.save();

    return res.status(201).json({ message: 'Movie added to your watchlist.' });
  } catch (error) {
    console.error('Adding movie to watchlist failed:', error.message);
    return res.status(500).json({ message: 'Could not update watchlist.' });
  }
});

router.get('/watchlist/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'A valid user ID is required.' });
  }

  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  try {
    const user = await User.findOne({
      _id: req.params.userId,
      sessionTokenHash: hashSessionToken(token),
    }).select('watchlist');
    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or does not match this user.' });
    }

    return res.json(user.watchlist);
  } catch (error) {
    console.error('Loading watchlist failed:', error.message);
    return res.status(500).json({ message: 'Could not load watchlist.' });
  }
});

router.delete('/watchlist/:userId/:movieId', async (req, res) => {
  const movieId = req.params.movieId;

  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'A valid user ID is required.' });
  }

  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  if (!/^tt\d+$/.test(movieId)) {
    return res.status(400).json({ message: 'A valid movie ID is required.' });
  }

  try {
    const user = await User.findOne({
      _id: req.params.userId,
      sessionTokenHash: hashSessionToken(token),
    });
    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or does not match this user.' });
    }

    user.watchlist = user.watchlist.filter((movie) => movie.id !== movieId);
    await user.save();

    return res.json({ message: 'Movie removed from your watchlist.' });
  } catch (error) {
    console.error('Removing movie from watchlist failed:', error.message);
    return res.status(500).json({ message: 'Could not update watchlist.' });
  }
});

module.exports = router;