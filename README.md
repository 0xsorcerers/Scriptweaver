# Scriptweaver Storyboarder

React + TypeScript local-first AI storyboard generator for books, stories, and excerpts.

## Features

- Project-based cache in `localStorage`, with scene frames and reusable character/environment prompt assets per project.
- Story input from pasted text and local file upload (`.txt`, `.rtf`, `.pdf`, `.doc`, `.docx`).
- Scene extraction into storyboard storycards.
- Deterministic local image generation for offline visual iteration.
- Optional external API mode for providers like Grok/Perplexity/custom endpoints.

## Run

```bash
npm install
npm run dev
```

> If you prefer local-only operation, keep **Generation Mode** set to **Local deterministic storyboard renderer**.
