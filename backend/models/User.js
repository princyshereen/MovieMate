const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  sessionTokenHash: {
    type: String,
    default: null,
  },
  watchlist: {
    type: [
      {
        _id: false,
        id: { type: String, required: true },
        title: { type: String, required: true },
        poster: { type: String, default: null },
        overview: { type: String, default: '' },
        releaseDate: { type: String, default: '' },
        rating: { type: Number, default: null },
      },
    ],
    default: [],
  },
  preferredLanguages: {
    type: [String],
    default: [],
  },
  preferredGenres: {
    type: [String],
    default: [],
  },
  favoriteMovieTitles: {
    type: [String],
    default: [],
  },
  recommendationControls: {
    type: {
      focus: { type: String, default: 'balanced' },
      languageBoost: { type: String, default: 'all' },
      genreBoost: { type: String, default: '' },
      diversityBias: { type: Number, default: 0.5 },
      noveltyBias: { type: Number, default: 0.5 },
      popularityBias: { type: Number, default: 0.5 },
    },
    default: {},
  },
  onboardingCompleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('User', userSchema);