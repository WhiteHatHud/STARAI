#!/bin/bash

# Start FastAPI backend server
# Note: Redis and Celery worker run in separate containers

# Print Container Info
CONTAINER_IP=$(hostname -I | tr -d " \\t\\n\\r")

echo "=========================================="
echo "Starting STARAI Backend Server"
echo "=========================================="
echo "Container IP: ${CONTAINER_IP}"
echo "Redis URL: ${REDIS_URL:-redis://redis:6379/0}"
echo "MongoDB: Using MongoDB Atlas (from .env)"
echo "S3 Bucket: ${S3_BUCKET_NAME:-starai-dev-documents}"
echo "=========================================="

# Start uvicorn server
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info --ws websockets --workers 4