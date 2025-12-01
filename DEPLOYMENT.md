# Deployment Guide

This guide explains how to build and deploy LavinMQ demos.

## Demo Types

- **Static demos** (like chat-app): Client-side apps that can be deployed to any static hosting
- **Backend demos**: Server apps that need their own runtime environment

## Local Development

Each demo has its own development setup. See individual README files.

```bash
# Example: Run chat app locally
cd chat-app
npm install
npm run dev
```

## Building Static Demos

```bash
# Build all static demos
npm run build

# The public/ directory contains:
# - public/index.html        → Landing page
# - public/chat/             → Chat app
# - public/other-demo/       → Future demos
```

Individual demo builds:
```bash
# Build just the chat app
npm run build:chat
# Output: chat-app/dist/
```

## Deployment

Deploy the `public/` directory to any static hosting service of your choice:
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Your own web server
- Any other static host

Each service has its own deployment process - follow their documentation.

### Automatic Deployment

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys to GitHub Pages when you push to `main`. Enable GitHub Pages in your repo settings to use it.

## Environment Variables

Static demos may need environment variables set before building:

```bash
# Example for chat-app
cd chat-app
cp .env.example .env
# Edit .env with production values
```

Then build with those settings:
```bash
npm run build:chat
```

## Backend Demos

Backend demos handle their own deployment. Each will have:
- Its own README with setup instructions
- Its own hosting requirements
- A link from the landing page to the live instance

Example structure:
```
lavinmq-demos/
├── chat-app/          # Static → Deploy public/chat/
├── nodejs-worker/     # Backend → Deploy however you want
└── ruby-consumer/     # Backend → Deploy however you want
```

## Adding New Demos

### Static Demo
1. Create demo directory with build output to `dist/`
2. Add build script to root `package.json`:
   ```json
   "build:new-demo": "cd new-demo && npm install && VITE_BASE_PATH=/new-demo npm run build"
   ```
3. Update `scripts/prepare-deployment.js` DEMOS array:
   ```js
   { name: 'new-demo', source: 'new-demo/dist', dest: 'new-demo' }
   ```
4. Update landing page in `scripts/prepare-deployment.js`

### Backend Demo
1. Create demo directory
2. Add its own README with deployment instructions
3. Deploy to your chosen platform
4. Update landing page in `scripts/prepare-deployment.js` with external link
