import json
import os
import time
import uuid
from pathlib import Path

import pika
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"
TEMPLATES_DIR = BASE_DIR / "templates"

UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI(title="LavinMQ Image Demo")
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

AMQP_HOST = os.getenv("AMQP_HOST", "localhost")
AMQP_PORT = int(os.getenv("AMQP_PORT", "5672"))
AMQP_USER = os.getenv("AMQP_USER", "guest")
AMQP_PASSWORD = os.getenv("AMQP_PASSWORD", "guest")
AMQP_VHOST = os.getenv("AMQP_VHOST", "/")
AMQP_QUEUE = os.getenv("AMQP_QUEUE", "image_tasks")


def get_channel():
    credentials = pika.PlainCredentials(AMQP_USER, AMQP_PASSWORD)
    params = pika.ConnectionParameters(
        host=AMQP_HOST,
        port=AMQP_PORT,
        credentials=credentials,
        virtual_host=AMQP_VHOST,
        heartbeat=600,
        blocked_connection_timeout=300,
    )
    print("Opening API connection to broker...")
    connection = pika.BlockingConnection(params)
    print("API connection opened.")
    channel = connection.channel()
    channel.queue_declare(queue=AMQP_QUEUE, durable=True)
    return connection, channel


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    jobs = []
    for job_dir in sorted(OUTPUT_DIR.iterdir(), reverse=True):
        if job_dir.is_dir():
            outputs = sorted([p.name for p in job_dir.iterdir() if p.is_file()])
            jobs.append({"job_id": job_dir.name, "files": outputs})
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "jobs": jobs[:20]},
    )


@app.post("/upload", response_class=HTMLResponse)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    effect: str = Form("all"),
):
    extension = Path(file.filename).suffix.lower() or ".png"
    job_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    input_path = UPLOAD_DIR / f"{job_id}{extension}"

    with open(input_path, "wb") as f:
        f.write(await file.read())

    payload = {
        "job_id": job_id,
        "input_path": str(input_path),
        "effect": effect,
    }

    connection, channel = get_channel()

    try:
        print("Publishing message...")
        channel.basic_publish(
            exchange="",
            routing_key=AMQP_QUEUE,
            body=json.dumps(payload).encode("utf-8"),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        print("Message published. Sleeping for 10 seconds...")
        time.sleep(10)

    finally:
        print("Closing API connection.")
        if connection.is_open:
            connection.close()

    jobs = [{"job_id": job_id, "files": []}]
    for job_dir in sorted(OUTPUT_DIR.iterdir(), reverse=True):
        if job_dir.is_dir() and job_dir.name != job_id:
            outputs = sorted([p.name for p in job_dir.iterdir() if p.is_file()])
            jobs.append({"job_id": job_dir.name, "files": outputs})

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "jobs": jobs[:20],
            "message": f"Queued job {job_id}. Refresh in a few seconds to see the generated images.",
        },
    )