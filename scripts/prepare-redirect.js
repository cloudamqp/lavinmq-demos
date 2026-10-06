#!/usr/bin/env node
// Temporary: demo.lavinmq.com is retired and redirects to lavinmq.com.
// To bring the demos back, switch deploy.yml back to `npm run deploy`.
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = 'public';
const TARGET = 'https://lavinmq.com/';

const redirectHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to lavinmq.com</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${TARGET}">
  <meta http-equiv="refresh" content="0; url=${TARGET}">
  <script>location.replace("${TARGET}")</script>
</head>
<body>
  <p>This page has moved to <a href="${TARGET}">lavinmq.com</a>.</p>
</body>
</html>
`;

rmSync(PUBLIC_DIR, { recursive: true, force: true });
mkdirSync(PUBLIC_DIR, { recursive: true });

// index.html covers the root, 404.html covers every other path (e.g. /chat/...)
for (const file of ['index.html', '404.html']) {
  writeFileSync(join(PUBLIC_DIR, file), redirectHtml);
}
writeFileSync(join(PUBLIC_DIR, '.nojekyll'), '');

console.log(`✅ Redirect to ${TARGET} ready in ./${PUBLIC_DIR}/`);
