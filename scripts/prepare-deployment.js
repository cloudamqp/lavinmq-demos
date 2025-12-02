#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = 'public';
const DEMOS = [
  { name: 'chat', source: 'chat-app/dist', dest: 'chat' }
];

console.log('📦 Preparing deployment...\n');

// Create public directory
if (!existsSync(PUBLIC_DIR)) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Copy each demo to its subdirectory
for (const demo of DEMOS) {
  const destPath = join(PUBLIC_DIR, demo.dest);

  if (!existsSync(demo.source)) {
    console.error(`❌ Error: ${demo.source} does not exist. Run build first.`);
    process.exit(1);
  }

  console.log(`📁 Copying ${demo.name} demo...`);
  cpSync(demo.source, destPath, { recursive: true });

  // Copy index.html as 404.html for SPA routing on GitHub Pages
  const indexFile = join(destPath, 'index.html');
  const notFoundFile = join(destPath, '404.html');
  if (existsSync(indexFile)) {
    cpSync(indexFile, notFoundFile);
    console.log(`   ✓ Created 404.html for SPA routing`);
  }

  console.log(`   ✓ Deployed to ${destPath}`);
}

// Create index.html for root
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LavinMQ Demos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 800px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #1a202c;
      font-size: 2.5rem;
      margin-bottom: 16px;
    }
    .subtitle {
      color: #718096;
      font-size: 1.125rem;
      margin-bottom: 48px;
    }
    .demos {
      display: grid;
      gap: 24px;
    }
    .demo-card {
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      transition: all 0.3s;
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .demo-card:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
    }
    .demo-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 8px;
    }
    .demo-description {
      color: #718096;
      line-height: 1.6;
    }
    .demo-link {
      display: inline-block;
      margin-top: 12px;
      color: #667eea;
      font-weight: 500;
    }
    .footer {
      margin-top: 48px;
      text-align: center;
      color: #a0aec0;
      font-size: 0.875rem;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>LavinMQ Demos</h1>
    <p class="subtitle">Explore real-world applications built with LavinMQ</p>

    <div class="demos">
      <a href="/chat" class="demo-card">
        <div class="demo-title">💬 Chat Application</div>
        <div class="demo-description">
          A real-time chat app demonstrating zero-backend architecture with AMQP streams,
          OAuth2 authentication, and WebSocket connectivity.
        </div>
        <span class="demo-link">Launch demo →</span>
      </a>
    </div>

    <div class="footer">
      <p>
        Powered by <a href="https://lavinmq.com" target="_blank">LavinMQ</a> •
        <a href="https://github.com/cloudamqp/lavinmq" target="_blank">GitHub</a> •
        <a href="https://lavinmq.com/documentation" target="_blank">Documentation</a>
      </p>
    </div>
  </div>
</body>
</html>`;

const indexPath = join(PUBLIC_DIR, 'index.html');
writeFileSync(indexPath, indexHtml);
console.log(`\n✅ Deployment ready in ./${PUBLIC_DIR}/`);
console.log('\nDemo URLs:');
console.log('  / (root)         → Demo index');
console.log('  /chat            → Chat application');
