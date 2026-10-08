const express = require('express');

const router = express.Router();
const tamilMovieTitles = [
  '96',
  'Vikram',
  'Kaithi',
  'Jailer',
  'Vaaranam Aayiram',
  'Raja Rani',
  'Soorarai Pottru',
  'Pariyerum Perumal',
  'Asuran',
  'Doctor',
];

function getPoster(movie) {
  return movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : null;
}

function mapMovieDetails(movie) {
  const poster = getPoster(movie);
  const plot = movie.Plot && movie.Plot !== 'N/A' ? movie.Plot : '';
  const imdbRating = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : null;
  const year = movie.Year && movie.Year !== 'N/A' ? movie.Year : '';

  return {
    imdbID: movie.imdbID,
    Title: movie.Title,
    Year: year,
    Genre: movie.Genre === 'N/A' ? '' : movie.Genre || '',
    Director: movie.Director === 'N/A' ? '' : movie.Director || '',
    Actors: movie.Actors === 'N/A' ? '' : movie.Actors || '',
    Plot: plot,
    Poster: poster,
    imdbRating,
    Runtime: movie.Runtime === 'N/A' ? '' : movie.Runtime || '',
    Language: movie.Language === 'N/A' ? '' : movie.Language || '',
  };
}

async function fetchFromOMDb(params) {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    const error = new Error('OMDB_API_KEY is not configured.');
    error.status = 500;
    throw error;
  }

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', apiKey);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`OMDb returned HTTP ${response.status}.`);
    error.status = 502;
    throw error;
  }

  const data = await response.json();
  if (data.Response === 'False') {
    const error = new Error(data.Error || 'OMDb request failed.');
    error.status = data.Error === 'Movie not found!'
      ? 404
      : data.Error === 'Request limit reached!'
        ? 429
        : data.Error === 'Invalid API key!'
          ? 401
          : 502;
    throw error;
  }

  return data;
}

function handleOMDbError(res, error) {
  console.error('OMDb request failed:', error.message);

  if (error.status === 404) {
    return res.status(404).json({ message: 'Movie not found.' });
  }
  if (error.status === 429) {
    return res.status(429).json({ message: 'OMDb request limit reached. Try again later.' });
  }
  if (error.status === 401) {
    return res.status(502).json({ message: 'OMDb rejected the API key. Check OMDB_API_KEY.' });
  }
  if (error.status === 500) {
    return res.status(500).json({ message: 'OMDB_API_KEY is not configured.' });
  }

  return res.status(502).json({ message: 'Could not retrieve movies from OMDb.' });
}

async function searchMovies(query) {
  const data = await fetchFromOMDb({ s: query, type: 'movie' });
  return Promise.all(
    (data.Search || []).map(async (movie) => {
      const details = await fetchFromOMDb({ i: movie.imdbID, plot: 'full' });
      return mapMovieDetails(details);
    }),
  );
}

async function sendSearchResults(res, query) {
  try {
    return res.json(await searchMovies(query));
  } catch (error) {
    if (error.status === 404) {
      return res.json([]);
    }
    return handleOMDbError(res, error);
  }
}

router.get('/', (req, res) => {
  const query = process.env.OMDB_DEFAULT_SEARCH || 'Batman';
  return sendSearchResults(res, query);
});

router.get('/search/:query', async (req, res) => {
  const query = req.params.query.trim();
  if (!query) {
    return res.status(400).json({ message: 'Search query is required.' });
  }

  return sendSearchResults(res, query);
});

router.get('/tamil', async (req, res) => {
  try {
    const results = await Promise.all(tamilMovieTitles.map(async (title) => {
      try {
        const movie = await fetchFromOMDb({ t: title, type: 'movie', plot: 'full' });
        return mapMovieDetails(movie);
      } catch (error) {
        if (error.status === 404) {
          return null;
        }
        throw error;
      }
    }));

    return res.json(results.filter(Boolean));
  } catch (error) {
    return handleOMDbError(res, error);
  }
});

router.get('/regional', async (req, res) => {
  const languageLookup = {
    Tamil: ['96', 'Vikram', 'Kaithi', 'Asuran', 'Doctor', 'Raja Rani'],
    English: ['Arrival', 'The Social Network', 'Dune', 'The Matrix', 'Inception'],
    Hindi: ['3 Idiots', 'Lagaan', 'Gully Boy', 'The Lunchbox', 'Padmaavat'],
    Telugu: ['RRR', 'Baahubali', 'Karthikeya', 'Arjun Reddy', 'Sye Raa Narasimha Reddy'],
    Malayalam: ['Premam', 'Minnal Murali', 'The Great Indian Kitchen', 'Bangalore Days'],
    Kannada: ['Kantara', 'KGF', 'Lucia', 'U-Turn'],
  };

  const requestedLanguage = (req.query.language || 'Tamil').toString();
  const selectedLanguages = languageLookup[requestedLanguage]
    ? [requestedLanguage]
    : Object.keys(languageLookup);

  try {
    const results = await Promise.all(selectedLanguages.flatMap((language) => (
      languageLookup[language].map(async (title) => {
        try {
          const movie = await fetchFromOMDb({ t: title, type: 'movie', plot: 'full' });
          const mappedMovie = mapMovieDetails(movie);
          return { ...mappedMovie, language: language };
        } catch (error) {
          if (error.status === 404) {
            return null;
          }
          throw error;
        }
      })
    )));

    return res.json(results.filter(Boolean).slice(0, 12));
  } catch (error) {
    return handleOMDbError(res, error);
  }
});

router.get('/:imdbId', async (req, res) => {
  if (!/^tt\d+$/.test(req.params.imdbId)) {
    return res.status(400).json({ message: 'Movie ID must be a valid IMDb ID, such as tt0133093.' });
  }

  try {
    const movie = await fetchFromOMDb({ i: req.params.imdbId, plot: 'full' });
    return res.json(mapMovieDetails(movie));
  } catch (error) {
    return handleOMDbError(res, error);
  }
});

module.exports = router;