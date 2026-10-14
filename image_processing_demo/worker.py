import json
import os
import time
from pathlib import Path

import pika
from PIL import Image, ImageFilter, ImageOps

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

AMQP_HOST = os.getenv("AMQP_HOST", "localhost")
AMQP_PORT = int(os.getenv("AMQP_PORT", "5672"))
AMQP_USER = os.getenv("AMQP_USER", "guest")
AMQP_PASSWORD = os.getenv("AMQP_PASSWORD", "guest")
AMQP_VHOST = os.getenv("AMQP_VHOST", "/")
AMQP_QUEUE = os.getenv("AMQP_QUEUE", "image_tasks")

DEMO_DELAY_SECONDS = int(os.getenv("DEMO_DELAY_SECONDS", "4"))


def ensure_job_dir(job_id: str) -> Path:
    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    return job_dir


def process_all(image: Image.Image, job_dir: Path, original_name: str):
    grayscale = ImageOps.grayscale(image)
    grayscale.save(job_dir / f"grayscale_{original_name}")

    blur = image.filter(ImageFilter.GaussianBlur(radius=6))
    blur.save(job_dir / f"blur_{original_name}")

    thumb = image.copy()
    thumb.thumbnail((250, 250))
    thumb.save(job_dir / f"thumbnail_{original_name}")


def process_one(image: Image.Image, job_dir: Path, original_name: str, effect: str):
    if effect == "grayscale":
        ImageOps.grayscale(image).save(job_dir / f"grayscale_{original_name}")
    elif effect == "blur":
        image.filter(ImageFilter.GaussianBlur(radius=6)).save(job_dir / f"blur_{original_name}")
    elif effect == "thumbnail":
        thumb = image.copy()
        thumb.thumbnail((250, 250))
        thumb.save(job_dir / f"thumbnail_{original_name}")
    else:
        process_all(image, job_dir, original_name)


def callback(ch, method, properties, body):
    try:
        payload = json.loads(body.decode("utf-8"))
        job_id = payload["job_id"]
        input_path = Path(payload["input_path"])
        effect = payload.get("effect", "all")

        print(f"[worker] Received job {job_id} for {input_path.name} with effect={effect}")
        time.sleep(DEMO_DELAY_SECONDS)

        job_dir = ensure_job_dir(job_id)

        if not input_path.exists():
           raise FileNotFoundError(f"Input file not found: {input_path}")

        with Image.open(input_path) as image:
           process_one(image, job_dir, input_path.name, effect)

        print(f"[worker] Finished job {job_id}. Output saved in {job_dir}")

        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as exc:
        print(f"[worker] Failed to process message: {exc}")

        ch.basic_nack(
            delivery_tag=method.delivery_tag,
            requeue=False,
        )


def main():
    credentials = pika.PlainCredentials(AMQP_USER, AMQP_PASSWORD)
    params = pika.ConnectionParameters(
        host=AMQP_HOST,
        port=AMQP_PORT,
        credentials=credentials,
        virtual_host=AMQP_VHOST,
        heartbeat=600,
        blocked_connection_timeout=300,
    )
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue=AMQP_QUEUE, durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=AMQP_QUEUE, on_message_callback=callback)

    print("[worker] Waiting for image tasks...")
    channel.start_consuming()


if __name__ == "__main__":
    main()
