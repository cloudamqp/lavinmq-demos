# Deployment Guide

This guide explains how to deploy LavinMQ demos. Demos fall into two categories:

- **Static demos** (like chat-app): Can be deployed to S3, GitHub Pages, Netlify, etc.
- **Backend demos**: Require their own hosting (Heroku, fly.io, VPS, etc.)

## Static Demos Deployment

### Quick Deploy to S3, GitHub Pages, or Static Hosting

```bash
# Build all static demos
npm run build

# The public/ directory is now ready to deploy
# - public/index.html        → Landing page at demo.lavinmq.com/
# - public/chat/             → Chat app at demo.lavinmq.com/chat
```

### GitHub Pages

The repository is configured for GitHub Pages deployment. Just enable it in your repo settings:

1. Go to Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` (will be created automatically)
4. Push to main triggers automatic deployment

Or deploy manually:
```bash
npm run deploy:gh-pages
```

### AWS S3 + CloudFront

```bash
# Build first
npm run build

# Deploy to S3
aws s3 sync public/ s3://demo.lavinmq.com --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=public
```

## Build Process for Static Demos

The build process:

1. **Build each static demo** with the correct base path
   - Chat app: builds with `VITE_BASE_PATH=/chat`
   - Future static demos added here

2. **Prepare deployment** directory
   - Creates `public/` directory
   - Copies built demos to subdirectories
   - Generates landing page at root

## Backend Demos Deployment

Backend demos (Node.js, Ruby, Python, etc.) handle their own deployment. Each will have:

- Their own `README.md` with deployment instructions
- Their own hosting requirements (Heroku, fly.io, Railway, VPS, etc.)
- A link from the landing page to their hosted instance

Example structure:
```
lavinmq-demos/
├── chat-app/          # Static → Deployed with other static demos
├── nodejs-worker/     # Backend → Deploys to Heroku
├── ruby-consumer/     # Backend → Deploys to fly.io
└── python-publisher/  # Backend → Deploys to Railway
```

The landing page (`public/index.html`) will link to:
- Static demos: `/chat`, `/another-static-demo`
- Backend demos: `https://nodejs-worker.herokuapp.com`, etc.

## Individual Demo Builds

```bash
# Build only the chat app (static)
npm run build:chat

# Backend demos build/deploy independently
cd nodejs-worker && npm run deploy
```

## Nginx Configuration (Optional - if hosting static demos yourself)

If you're using S3/GitHub Pages, you don't need nginx. But if hosting on your own server:

```nginx
server {
    listen 80;
    server_name demo.lavinmq.com;

    root /var/www/lavinmq-demos/public;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root landing page
    location = / {
        try_files /index.html =404;
    }

    # Static demos (chat, etc.)
    location /chat {
        try_files $uri $uri/ /chat/index.html;
    }

    # Backend demos would be separate deployments
    # No need to proxy them here - they run on their own

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;
}
```

## Environment Variables for Static Demos

Each demo may have its own environment variables. For the chat app:

```bash
# Create chat-app/.env for production
VITE_AMQP_URL=wss://your-lavinmq-instance.com:15692
VITE_OAUTH_CLIENT_ID=your_oauth_client_id
VITE_OAUTH_REDIRECT_URI=https://demo.lavinmq.com/chat
```

Remember to set these before building for production!

## Adding New Demos

### Static Demo
1. Create demo in a new directory (e.g., `static-demo/`)
2. Add build script to root `package.json`:
   ```json
   "build:static-demo": "cd static-demo && npm install && VITE_BASE_PATH=/static-demo npm run build"
   ```
3. Update `scripts/prepare-deployment.js` DEMOS array:
   ```js
   { name: 'static-demo', source: 'static-demo/dist', dest: 'static-demo' }
   ```
4. Update the landing page link in `scripts/prepare-deployment.js`

### Backend Demo
1. Create demo in a new directory (e.g., `nodejs-worker/`)
2. Add its own `README.md` with deployment instructions
3. Deploy to your chosen platform (Heroku, fly.io, etc.)
4. Add external link to landing page in `scripts/prepare-deployment.js`
