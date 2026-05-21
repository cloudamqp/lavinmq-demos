# LavinMQ Image Processing Demo

A visual demo that shows LavinMQ doing a tangible task:

1. Upload an image in the browser
2. The API saves it and publishes a job to LavinMQ
3. A worker consumes the job
4. The worker applies the image effect selected in the UI. Available options include:
   - grayscale
   - blur
   - thumbnail
   - all
5. The browser displays the generated images

## Architecture

```text
client -> API -> LavinMQ -> Worker -> output images
```

## Files

- `app.py` - FastAPI app and upload endpoint
- `worker.py` - background worker that processes images
- `templates/index.html` - simple UI
- `requirements.txt` - dependencies

## Environment variables

You can point the app at your LavinMQ instance using:

- `AMQP_HOST` (default: `localhost`)
- `AMQP_PORT` (default: `5672`)
- `AMQP_USER` (default: `guest`)
- `AMQP_PASSWORD` (default: `guest`)
- `AMQP_QUEUE` (default: `image_tasks`)
- `AMQP_VHOST` (default: `/`)
- `DEMO_DELAY_SECONDS` (default: `4`) - optional worker delay to make background processing easier to observe during demos

If you provide the vhost in an AMQP URL, the default `/` vhost may need to be URL-encoded as `%2f`.

## Install

```bash
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
pip install -r requirements.txt
```

## Run

### 1. Start the worker

```bash
python worker.py
```

### 2. Start the API

```bash
uvicorn app:app --reload
```

### 3. Open the browser

Visit:

```text
http://127.0.0.1:8000
```

## Demo flow to show live

- Open the app in one browser window
- Open the LavinMQ management UI in another
- Upload an image
- Show the queue receive a message
- Show the worker logs
- Refresh the page and show the generated images

## Live talking point

> “Instead of processing the image directly in the API, we hand the job to LavinMQ. The worker picks it up asynchronously and produces visible output.”

## Demo delay

The worker includes an optional delay controlled by `DEMO_DELAY_SECONDS`.

This makes the queue behavior easier to observe during live demonstrations.

## Shared Filesystem Assumption

This demo assumes the API server and worker share the same filesystem or run on the same machine/container environment.

The API publishes the uploaded file path to the queue, and the worker reads the file directly from disk using that path.

In production systems where API and workers run on separate hosts, files are typically stored in shared object storage such as S3, Azure Blob Storage, or MinIO.