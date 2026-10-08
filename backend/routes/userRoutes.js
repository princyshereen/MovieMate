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
    preferredLanguages: user.preferredLanguages || [],
    preferredGenres: user.preferredGenres || [],
    favoriteMovieTitles: user.favoriteMovieTitles || [],
    recommendationControls: user.recommendationControls || {},
    onboardingCompleted: !!user.onboardingCompleted,
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

function normalizeList(items, maxLength = 8) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (typeof item !== 'string') {
      continue;
    }

    const cleaned = item.trim();
    if (!cleaned || seen.has(cleaned.toLowerCase())) {
      continue;
    }

    seen.add(cleaned.toLowerCase());
    result.push(cleaned);
    if (result.length >= maxLength) {
      break;
    }
  }

  return result;
}

function normalizeLanguage(language) {
  if (typeof language !== 'string') {
    return '';
  }

  const normalized = language.trim();
  if (!normalized) {
    return '';
  }

  const map = {
    tamil: 'Tamil',
    english: 'English',
    hindi: 'Hindi',
    telugu: 'Telugu',
    malayalam: 'Malayalam',
    kannada: 'Kannada',
  };

  return map[normalized.toLowerCase()] || normalized;
}

function normalizeGenre(genre) {
  if (typeof genre !== 'string') {
    return '';
  }

  const trimmed = genre.trim();
  return trimmed ? trimmed : '';
}

function candidateLanguageSet(user) {
  const languageList = normalizeList(user.preferredLanguages || [], 6)
    .map(normalizeLanguage)
    .filter(Boolean);

  return languageList.length ? languageList : ['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam', 'Kannada'];
}

function candidateGenreSet(user) {
  const genres = normalizeList(user.preferredGenres || [], 8)
    .map(normalizeGenre)
    .filter(Boolean);

  return genres.length ? genres : ['Action', 'Drama', 'Comedy', 'Adventure'];
}

async function fetchOmdbMovie(title) {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    return null;
  }

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('t', title);
  url.searchParams.set('type', 'movie');
  url.searchParams.set('plot', 'full');

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (data.Response === 'False') {
    return null;
  }

  return data;
}

function buildMovieSummary(movie) {
  if (!movie || typeof movie !== 'object') {
    return null;
  }

  const rating = Number(movie.imdbRating);

  return {
    id: typeof movie.imdbID === 'string' ? movie.imdbID : '',
    title: typeof movie.Title === 'string' ? movie.Title : '',
    poster: movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : null,
    overview: movie.Plot && movie.Plot !== 'N/A' ? movie.Plot : '',
    releaseDate: movie.Year && movie.Year !== 'N/A' ? movie.Year : '',
    rating: Number.isFinite(rating) ? rating : null,
    genre: movie.Genre && movie.Genre !== 'N/A' ? movie.Genre : '',
    director: movie.Director && movie.Director !== 'N/A' ? movie.Director : '',
    actors: movie.Actors && movie.Actors !== 'N/A' ? movie.Actors : '',
    runtime: movie.Runtime && movie.Runtime !== 'N/A' ? movie.Runtime : '',
    language: movie.Language && movie.Language !== 'N/A' ? movie.Language : '',
  };
}

function computeGenreOverlap(candidateGenres, profileGenres) {
  const candidateSet = new Set((candidateGenres || []).map((genre) => genre.trim().toLowerCase()).filter(Boolean));
  const profileSet = new Set((profileGenres || []).map((genre) => genre.trim().toLowerCase()).filter(Boolean));

  if (!candidateSet.size || !profileSet.size) {
    return 0;
  }

  let common = 0;
  for (const genre of candidateSet) {
    if (profileSet.has(genre)) {
      common += 1;
    }
  }

  return common / Math.max(candidateSet.size, profileSet.size);
}

function computeLanguageMatch(movieLanguage, preferredLanguages) {
  if (!movieLanguage || !preferredLanguages.length) {
    return 0;
  }

  const normalizedMovieLanguage = normalizeLanguage(movieLanguage);
  return preferredLanguages.some((language) => normalizeLanguage(language) === normalizedMovieLanguage) ? 1 : 0;
}

function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase();
}

function titleSimilarity(movieTitle, seedTitles) {
  const normalizedTitle = normalizeTitle(movieTitle);
  if (!normalizedTitle) {
    return 0;
  }

  let highest = 0;
  for (const title of seedTitles) {
    const normalizedSeed = normalizeTitle(title);
    if (!normalizedSeed || normalizedSeed === normalizedTitle) {
      continue;
    }

    const longer = Math.max(normalizedTitle.length, normalizedSeed.length);
    if (!longer) {
      continue;
    }

    const common = [...normalizedTitle].filter((character) => normalizedSeed.includes(character)).length;
    highest = Math.max(highest, common / longer);
  }

  return highest;
}

function movieGenres(movie) {
  return (movie.genre || '')
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function createRecommendationExplanation(movie, user, score, reasons) {
  const languageReasons = [];
  const preferredLanguages = candidateLanguageSet(user);
  const preferredGenres = candidateGenreSet(user);

  if (movie.language && preferredLanguages.includes(movie.language)) {
    languageReasons.push(`your preferred ${movie.language} language match`);
  }

  const matchedGenres = movieGenres(movie).filter((genre) => preferredGenres.some((preferredGenre) => preferredGenre.toLowerCase() === genre.toLowerCase()));
  if (matchedGenres.length) {
    languageReasons.push(`your ${matchedGenres.join(', ')} preference`);
  }

  if ((user.watchlist || []).some((savedMovie) => savedMovie.title === movie.title)) {
    languageReasons.push('it is already in your watchlist');
  }

  if (score > 0.75) {
    languageReasons.push('it has a solid rating profile');
  }

  const actualReasons = reasons.length ? reasons : [
    languageReasons[0] ? `Recommended because it aligns with ${languageReasons.join(' and ')}.` : 'Recommended because it balances relevance and discovery.',
  ];

  return actualReasons[0];
}

async function buildUserRecommendations(user, preferenceOverride = '') {
  const preferredLanguages = candidateLanguageSet(user);
  const preferredGenres = candidateGenreSet(user);
  const favoriteTitles = normalizeList(user.favoriteMovieTitles || [], 6);
  const watchlistTitles = (user.watchlist || []).map((movie) => movie.title).filter(Boolean);
  const seedTitles = Array.from(new Set([...favoriteTitles, ...watchlistTitles, ...preferredLanguages.flatMap((language) => {
    const seedMap = {
      Tamil: ['96', 'Vikram', 'Kaithi', 'Asuran', 'Doctor', 'Raja Rani', 'Soorarai Pottru'],
      English: ['Dune', 'The Matrix', 'The Social Network', 'Arrival', 'Inception', 'The Grand Budapest Hotel'],
      Hindi: ['3 Idiots', 'Lagaan', 'The Lunchbox', 'Zindagi Na Milegi Dobara', 'Gully Boy'],
      Telugu: ['Baahubali', 'RRR', 'Karthikeya', 'Arjun Reddy', 'Sye Raa Narasimha Reddy'],
      Malayalam: ['Premam', 'The Great Indian Kitchen', 'Bangalore Days', 'Minnal Murali'],
      Kannada: ['KGF', 'Kantara', 'Lucia', 'U-Turn'],
    };

    return seedMap[language] || [];
  })]));

  const candidateMovies = [];
  for (const title of seedTitles) {
    if (!title) {
      continue;
    }

    const movie = await fetchOmdbMovie(title);
    const summary = buildMovieSummary(movie);
    if (!summary || !summary.id || !summary.title) {
      continue;
    }

    candidateMovies.push(summary);
  }

  const results = [];
  for (const movie of candidateMovies) {
    if ((user.watchlist || []).some((savedMovie) => savedMovie.id === movie.id)) {
      continue;
    }

    const languageMatch = computeLanguageMatch(movie.language, preferredLanguages);
    const genreOverlap = computeGenreOverlap(movieGenres(movie), preferredGenres);
    const titleMatch = titleSimilarity(movie.title, favoriteTitles.concat(watchlistTitles));
    const ratingBoost = movie.rating ? movie.rating / 10 : 0;
    const popularityWeight = preferenceOverride === 'more-popular' ? 0.35 : 0.18;
    const noveltyWeight = preferenceOverride === 'discover-new' ? 0.25 : 0.12;
    const languageBoost = preferenceOverride === 'more-tamil' || preferenceOverride === 'more-english' || preferenceOverride === 'more-hindi' || preferenceOverride === 'more-telugu' || preferenceOverride === 'more-malayalam' || preferenceOverride === 'more-kannada'
      ? (movie.language && normalizeLanguage(movie.language) === preferenceOverride.replace('more-', '').replace(/^./, (first) => first.toUpperCase())) ? 0.3 : 0
      : 0;
    const actionBoost = preferenceOverride === 'more-action' && movieGenres(movie).some((genre) => genre.toLowerCase().includes('action')) ? 0.25 : 0;
    const romanceBoost = preferenceOverride === 'more-romance' && movieGenres(movie).some((genre) => genre.toLowerCase().includes('romance')) ? 0.25 : 0;
    const diversityBoost = (movie.language && !preferredLanguages.includes(movie.language)) ? 0.1 : 0;
    const yearWeight = movie.releaseDate ? Number(movie.releaseDate) : 0;
    const ageValue = Number.isFinite(yearWeight) && yearWeight > 0 ? Math.min(1, (new Date().getFullYear() - yearWeight + 1) / 12) : 0;

    let score = 0.18 + languageMatch * 0.26 + genreOverlap * 0.28 + titleMatch * 0.22 + ratingBoost * 0.22 + popularityWeight * 0.18 + noveltyWeight * ageValue + diversityBoost + languageBoost + actionBoost + romanceBoost;

    if (!preferredLanguages.length && !favoriteTitles.length) {
      score += 0.08;
    }

    if (score > 0.2) {
      const reasons = [];
      if (languageMatch > 0) {
        reasons.push(`Recommended because it matches your preferred language, ${movie.language}.`);
      }
      if (genreOverlap > 0) {
        reasons.push(`Recommended because it shares your selected genre interests.`);
      }
      if (titleMatch > 0) {
        reasons.push('Recommended because it feels similar to a title you already care about.');
      }
      if (movie.rating) {
        reasons.push(`Recommended because its rating is strong at ${movie.rating}/10.`);
      }
      if (preferenceOverride === 'discover-new') {
        reasons.push('Recommended because it adds a less familiar title to your discovery mix.');
      }
      if ((movie.language && !preferredLanguages.includes(movie.language)) || diversityBoost > 0) {
        reasons.push('Recommended because it adds diversity to the recommendation list.');
      }

      results.push({
        ...movie,
        score: Number(score.toFixed(3)),
        explanation: createRecommendationExplanation(movie, user, score, reasons),
      });
    }
  }

  const uniqueMovies = Array.from(new Map(results.map((movie) => [movie.id, movie])).values());
  return uniqueMovies.sort((a, b) => b.score - a.score).slice(0, 8);
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

router.get('/profile/:userId', async (req, res) => {
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
    });

    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or does not match this user.' });
    }

    return res.json({
      user: publicUser(user),
      profile: {
        preferredLanguages: user.preferredLanguages || [],
        preferredGenres: user.preferredGenres || [],
        favoriteMovieTitles: user.favoriteMovieTitles || [],
        recommendationControls: user.recommendationControls || {},
        onboardingCompleted: !!user.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Loading profile failed:', error.message);
    return res.status(500).json({ message: 'Could not load the user profile.' });
  }
});

router.post('/preferences/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'A valid user ID is required.' });
  }

  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  const { preferredLanguages, preferredGenres, favoriteMovieTitles, recommendationControls } = req.body || {};

  try {
    const user = await User.findOne({
      _id: req.params.userId,
      sessionTokenHash: hashSessionToken(token),
    });

    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or does not match this user.' });
    }

    const sanitizedLanguages = normalizeList(preferredLanguages || [], 6)
      .map(normalizeLanguage)
      .filter(Boolean);
    const sanitizedGenres = normalizeList(preferredGenres || [], 8)
      .map(normalizeGenre)
      .filter(Boolean);
    const sanitizedFavorites = normalizeList(favoriteMovieTitles || [], 6);

    const nextControls = {
      focus: typeof recommendationControls?.focus === 'string' ? recommendationControls.focus : 'balanced',
      languageBoost: typeof recommendationControls?.languageBoost === 'string' ? recommendationControls.languageBoost : 'all',
      genreBoost: typeof recommendationControls?.genreBoost === 'string' ? recommendationControls.genreBoost : '',
      diversityBias: Number.isFinite(Number(recommendationControls?.diversityBias)) ? Number(recommendationControls.diversityBias) : 0.5,
      noveltyBias: Number.isFinite(Number(recommendationControls?.noveltyBias)) ? Number(recommendationControls.noveltyBias) : 0.5,
      popularityBias: Number.isFinite(Number(recommendationControls?.popularityBias)) ? Number(recommendationControls.popularityBias) : 0.5,
    };

    user.preferredLanguages = sanitizedLanguages;
    user.preferredGenres = sanitizedGenres;
    user.favoriteMovieTitles = sanitizedFavorites;
    user.recommendationControls = nextControls;
    user.onboardingCompleted = true;
    await user.save();

    return res.json({
      message: 'Your recommendation profile has been saved.',
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Saving preferences failed:', error.message);
    return res.status(500).json({ message: 'Could not save your recommendation preferences.' });
  }
});

router.get('/recommendations/:userId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: 'A valid user ID is required.' });
  }

  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  const focus = typeof req.query.focus === 'string' ? req.query.focus.trim() : '';

  try {
    const user = await User.findOne({
      _id: req.params.userId,
      sessionTokenHash: hashSessionToken(token),
    });

    if (!user) {
      return res.status(401).json({ message: 'Session is invalid or does not match this user.' });
    }

    const recommendationFocus = focus || (user.recommendationControls && user.recommendationControls.focus) || 'balanced';
    const recommendations = await buildUserRecommendations(user, recommendationFocus);

    return res.json({
      recommendations,
      profile: {
        preferredLanguages: user.preferredLanguages || [],
        preferredGenres: user.preferredGenres || [],
        favoriteMovieTitles: user.favoriteMovieTitles || [],
        recommendationControls: user.recommendationControls || {},
      },
    });
  } catch (error) {
    console.error('Generating recommendations failed:', error.message);
    return res.status(500).json({ message: 'Could not generate recommendations.' });
  }
});

module.exports = router;