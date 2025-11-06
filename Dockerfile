FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core libreoffice-writer \
    redis-server \
    gcc \
    g++ \
    build-essential \
    git \
    libmagic1 \
    ffmpeg \
    libsndfile1 \
    wget \
    ca-certificates \
    curl \
    util-linux \
    procps \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \ 
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

ENV ENVIRONMENT=production
ENV APP_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Project Variants: sof | case_study | custom | slide
ENV PROJECT_VARIANT=custom

# Set to false to skip the marker process
ENV GPU_USAGE=true

COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install

COPY frontend/ ./

RUN export VITE_PROJECT_VARIANT="$PROJECT_VARIANT" && \
    if [ "$PROJECT_VARIANT" = "sof" ]; then \
    export VITE_PUBLIC_URL="/qsynthesis/container/sof-starai-ej154-test"; \
    export VITE_API_BASE_URL="/qsynthesis/container/sof-starai-ej154-test/api"; \
    elif [ "$PROJECT_VARIANT" = "case_study" ]; then \
    export VITE_PUBLIC_URL="/qsynthesis/container/casestudy-starai-1a5sc-test"; \
    export VITE_API_BASE_URL="/qsynthesis/container/casestudy-starai-1a5sc-test/api"; \
    elif [ "$PROJECT_VARIANT" = "custom" ]; then \
    export VITE_PUBLIC_URL="/qsynthesis/container/custom-starai-lck50-test"; \
    export VITE_API_BASE_URL="/qsynthesis/container/custom-starai-lck50-test/api"; \
    else \
    export VITE_PUBLIC_URL=""; \
    export VITE_API_BASE_URL="/api"; \
    fi && \
    export VITE_GPU_USAGE="$GPU_USAGE" && \
    npm run build

WORKDIR /app

COPY backend/.env ./
RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -O /app/global-bundle.pem

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir setuptools wheel cython && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

COPY frontend/src/presentation_templates /app/presentation_templates

RUN chmod +x ./start.sh

EXPOSE 8000

ENTRYPOINT ["sh", "/app/start.sh"]