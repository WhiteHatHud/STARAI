# app/core/celery_app.py
from celery import Celery
import os
import redis
from dotenv import load_dotenv

load_dotenv()

# Create Celery app with proper configuration
celery_app = Celery(
    "starai_backend",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=['app.tasks.report_tasks', 'app.tasks.template_tasks', 'app.tasks.document_tasks']
)

# Configure Celery settings
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Redis connection
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", "6379"))
redis_db = int(os.getenv("REDIS_DB", "0"))

r = redis.Redis(host=redis_host, port=redis_port, db=redis_db)
MAPPING_KEY = "starai_backend"