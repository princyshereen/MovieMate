# Movie Explorer: explainable recommendation system

This project extends the existing Movie Explorer application with a lightweight, explainable recommendation engine designed to explore real recommender-system challenges without introducing a heavy ML stack.

## Research concept

The recommendation engine is intentionally simple and transparent. It combines user-defined signals with a small set of explainable ranking heuristics instead of relying on a hidden black-box model.

A simplified score looks like this:

score = 0.18 + languageMatch * 0.26 + genreOverlap * 0.28 + titleSimilarity * 0.22 + ratingBoost * 0.22 + popularityWeight * 0.18 + noveltyWeight * ageValue + diversityBias + userControlBoost

The system uses these signals:

- watchlist similarity
- preferred language matching
- preferred genre alignment
- favorite movie titles and onboarding selections
- rating quality
- popularity and novelty balance
- user-controlled ranking adjustments

## Cold-start support

New users complete a short onboarding form that captures:

- preferred languages
- preferred genres
- a few favorite movie titles

These values are saved to MongoDB and used immediately to generate referrals that are more personal than generic trending results.

## Explainability

Each recommended movie includes a short explanation backed by actual matching signals such as:

- preferred language match
- genre overlap with the user's profile
- similarity to titles the user marked as favorites
- strong rating signal
- diversity or novelty contribution

## User control

Users can steer the recommendation mix by selecting controls such as:

- more Tamil
- more English
- more popular
- discover new
- more action
- more romance

This keeps the recommendation process transparent and user-controlled instead of opaque.

## Diversity and cultural awareness

The system explicitly balances relevance and diversity. It includes regional cinema exploration and avoids returning only a set of near-identical popular movies. The recommendation list intentionally mixes highly relevant titles with some less mainstream or cross-language discovery picks.

## Limitations

This is a transparent heuristic recommender rather than a production-grade personalized ML system. It has clear limitations:

- it does not learn from large user interaction data
- it depends on the availability and quality of OMDb metadata
- it cannot deeply model nuanced user taste across many users
- cultural discovery is still limited by the metadata available in the external API
- the recommendation score is intentionally interpretable, not maximally optimized

The goal is to make the recommender academically explainable and easy to extend, while keeping the application understandable for a student project.
