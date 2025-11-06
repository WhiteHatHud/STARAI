# 📄 STARAI — Intelligent Document-Powered Form & Report Generator

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Ant Design](https://img.shields.io/badge/Ant%20Design-0170FE?style=for-the-badge&logo=ant-design)

> A powerful full-stack web application that lets users **upload documents**, extract data, and use that data to **fill forms** or **generate case studies** — fast, smart, and seamless.

---

## 🚀 Features

- 📄 Upload your own documents (PDF, DOCX, etc.)
- 🧩 Generate custom templates via input documents
- 📘 Generate case studies from extracted data
- ⚡ FastAPI backend for rapid performance
- 💾 MongoDB for flexible document storage
- 🧩 React + Ant Design frontend for modern UI

---

## 🛠️ Technologies Used

- **Frontend**: React, Ant Design
- **Backend**: FastAPI, Python, Celery
- **Database**: MongoDB (local development)
- **Async/Queue**: Redis (embedded in backend container) + Celery workers
- **Containerization**: Docker, Docker Compose

---


## 🎯 STARAI Variants

STARAI supports three specialized document generation variants, each optimized for different use cases:

### 📋 **SOF** (Statement of Facts)
Generates legal or factual statements for legal proceedings, investigations, or formal documentation. Creates structured fact presentations with evidence integration, legal formatting, and case documentation for court filings, insurance claims, and regulatory compliance reports.

### 📚 **Report**
Creates detailed analytical case studies for business, academic, or professional analysis. Structures content around problem-solution frameworks with data-driven insights, stakeholder analysis, and outcome measurement for business case studies, academic research, and industry analysis reports.

### 🔧 **Custom** (Custom Document)
Provides flexible document generation for any custom format or requirement. Uses template-based generation with modular components and dynamic content for specialized reports, industry-specific documentation, and one-off document generation needs.

---

## 📦 Prerequisites

- [Docker](https://www.docker.com/)

---

## 🧑‍💻 Getting Started

### 1. 📁 Clone the Repository

```bash
git clone https://github.com/HTX-Q3/STARAI-2025.git
cd STARAI-2025
```

### 2. ⚙️ Environment Configuration

The application supports three different environments controlled by the `APP_ENV` variable:

- **`development`**: Local development with Docker Compose and local MongoDB
- **`test`**: Full production build with Docker Compose and local MongoDB
- **`production`**: Full production deployment with AWS DocumentDB

#### Backend Environment Variables

Create a `.env.local` file in the `./backend/` directory:

**For Local Development (`APP_ENV=development`):**

```env
RESET_COLLECTIONS="true"

JWT_SECRET_KEY=<insert here>

# ------------------- Sagemaker (spark-hr) -------------------
SAGEMAKER_AWS_ACCESS_KEY_ID=<insert here>
SAGEMAKER_AWS_SECRET_ACCESS_KEY=<insert here>
SAGEMAKER_REGION=<insert here>

# ----------------------------- S3 Bucket (qsynthesis) -----------------------------
AWS_ACCESS_KEY_ID=<insert here>
AWS_SECRET_ACCESS_KEY=<insert here>
AWS_REGION=<insert here>

# ------------------- Sagemaker (qcaption) -------------------
SAGEMAKER_QWEN3_AWS_ACCESS_KEY_ID=<insert here>
SAGEMAKER_QWEN3_AWS_SECRET_ACCESS_KEY=<insert here>
SAGEMAKER_QWEN3_REGION=<insert here>

# ------------------- Redis ---------------------------
REDIS_URL="redis://localhost:6379/0"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_DB="0"
```

**For Test/Production (`APP_ENV=test` or `APP_ENV=production`):**

```env
# ------------------- GENEXIS ROOT URL (SOF ONLY) -------------------
SOF_URL=<insert here>

# ------------------- GENEXIS ROOT URL (CASE STUDIES ONLY) -------------------
CASE_STUDY_URL=<insert here>

# ------------------- GENEXIS ROOT URL (CUSTOM ONLY) -------------------
CUSTOM_URL=<insert here>

# ------------------- MONGO DB (CASE STUDIES + CUSTOM) -------------------
MONGO_CASE_AND_CUSTOM_DB_URI=<insert here>

# ------------------- MONGO DB (SOF) -------------------
MONGO_SOF_DB_URI=<insert here>

RESET_COLLECTIONS="true"

JWT_SECRET_KEY=<insert here>

# ------------------- Sagemaker (spark-hr) -------------------
SAGEMAKER_AWS_ACCESS_KEY_ID=<insert here>
SAGEMAKER_AWS_SECRET_ACCESS_KEY=<insert here>
SAGEMAKER_REGION=<insert here>

# ----------------------------- S3 Bucket (qsynthesis) -----------------------------
AWS_ACCESS_KEY_ID=<insert here>
AWS_SECRET_ACCESS_KEY=<insert here>
AWS_REGION=<insert here>

# ------------------- Sagemaker (qcaption) -------------------
SAGEMAKER_QWEN3_AWS_ACCESS_KEY_ID=<insert here>
SAGEMAKER_QWEN3_AWS_SECRET_ACCESS_KEY=<insert here>
SAGEMAKER_QWEN3_REGION=<insert here>

# ------------------- Redis ---------------------------
REDIS_URL="redis://localhost:6379/0"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_DB="0"
```

#### Database Connection Logic

The application automatically selects the appropriate database based on `APP_ENV`:

- **`development/test`**: Uses local MongoDB Atlas container (`mongodb://mongodb:27017`)
- **`production`**: Uses AWS DocumentDB connection based on `PROJECT_VARIANT`:
  - `sof` → Uses `MONGO_SOF_DB_URI`
  - `report` or `custom` → Uses `MONGO_CASE_AND_CUSTOM_DB_URI`

#### Frontend Environment Variables

Create a `.env.local` file in the `./frontend/` directory:

**For Local Development:**

```env
# Public base path for the SPA router
REACT_APP_PUBLIC_URL=/

# API base URL (points to local backend)
REACT_APP_API_BASE_URL=http://localhost:8000/api

# UI variant: sof | report | custom
REACT_APP_PROJECT_VARIANT=report
```

**For Deployment:**

```env
# These are automatically set during Docker build based on PROJECT_VARIANT
# No need to set manually - see deployment section below
REACT_APP_PUBLIC_URL=/qsynthesis/container/<variant-specific-path>
REACT_APP_API_BASE_URL=/qsynthesis/container/<variant-specific-path>/api
REACT_APP_PROJECT_VARIANT=<selected-variant>
```

### 3. 🐳 Docker Setup Options

#### Option A: Development Mode (Recommended for Local Development)

Use Docker Compose for local development with hot reloading and separate services:

```bash
# Start all services with hot reloading (frontend changes only)
docker compose up --build --watch

# Or start without hot reloading
docker compose up --build
```

This starts:

- **Backend** at `http://localhost:8000/` (FastAPI; docs at `/docs`)
- **Frontend** at `http://localhost:3000/`
- **MongoDB** local instance

#### Option B: Test Mode (Production Build Locally)

Use the production Dockerfile in test mode for integration testing:

```bash
# Build and run single container with test configuration
docker compose --profile test up --build
```

This starts:

- **Combined app** at `http://localhost:8000/` (serves both API and frontend)
- Uses `APP_ENV=test` with AWS DocumentDB connections

---

## 🔐 Development Login Credentials

To access the app during **local development**, use the following credentials:

```
Username: admin
Password: password123
```

These are **only for local testing** and should not be used in production deployments.

#### 🛑 Stop Services

```bash
# Stop development services
docker compose down

# Stop test service
docker compose --profile test down

# Clean up containers, networks, and volumes
docker system prune -a
```

---

## 🗃️ File Structure

```
starai-2025/
├── Dockerfile                 # Combined backend image (and optional frontend build)
├── backend/
│   ├── Dockerfile.backend
│   ├── .env
│   └── ...
├── frontend/
│   ├── Dockerfile.dev
│   ├── .env
│   └── ...
├── docker-compose.yml
└── README.md
```

---

## 🚀 Deployment Guide

### Step 1: Configure Project Variant

Before deploying, you need to set the `PROJECT_VARIANT` in the main `Dockerfile`. This determines which deployment configuration to use:

```dockerfile
# In the root Dockerfile, update this line:
ENV PROJECT_VARIANT=sof          # for SOF deployment
# ENV PROJECT_VARIANT=report  # for Report deployment
# ENV PROJECT_VARIANT=custom      # for Custom deployment
```

### Step 2: Choose Your Deployment Script

Based on your `PROJECT_VARIANT`, run the corresponding image script:

#### For SOF Deployment (`PROJECT_VARIANT=sof`)

```bash
# Set PROJECT_VARIANT=sof in Dockerfile, then run:
./sof-image-script.sh
```

#### For Report Deployment (`PROJECT_VARIANT=report`)

```bash
# Set PROJECT_VARIANT=report in Dockerfile, then run:
./reports-image-script.sh
```

#### For Custom Deployment (`PROJECT_VARIANT=custom`)

```bash
# Set PROJECT_VARIANT=custom in Dockerfile, then run:
./custom-image-script.sh
```

### Step 3: What the Deployment Scripts Do

Each script performs the following operations:

1. **Login to AWS ECR** using provided credentials
2. **Build Docker image** with the specified variant configuration
3. **Tag the image** for the appropriate ECR repository
4. **Push the image** to AWS ECR

**Image Tagging**: By default, all deployment scripts tag images with `:latest` unless otherwise specified within the script.

The `PROJECT_VARIANT` automatically configures:

- Frontend build paths (`REACT_APP_PUBLIC_URL` and `REACT_APP_API_BASE_URL`)
- ECR repository names and tags
- Deployment-specific environment settings

### Step 4: Deployment URLs

After successful deployment, access your application at:

| Variant    | Frontend URL                                                             | Backend URL                                                                  |
| ---------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| SOF        | `https://genexis.gov.sg/qsynthesis/container/sof-starai-ej154-test`       | `https://genexis.gov.sg/qsynthesis/container/sof-starai-ej154-test/api`       |
| Report | `https://genexis.gov.sg/qsynthesis/container/casestudy-starai-1a5sc-test` | `https://genexis.gov.sg/qsynthesis/container/casestudy-starai-1a5sc-test/api` |
| Custom     | `https://genexis.gov.sg/qsynthesis/container/custom-starai-lck50-test`    | `https://genexis.gov.sg/qsynthesis/container/custom-starai-lck50-test/api`    |

### Prerequisites for Deployment

- **AWS CLI** installed and configured
- **Docker** installed and running
- **AWS ECR access** with the provided credentials
- **Backend `.env` file** configured for production (see environment section above)

### Troubleshooting Deployment

If deployment fails:

1. **Check AWS credentials** are correctly set in the script
2. **Verify Docker is running** and you can build locally
3. **Ensure PROJECT_VARIANT** matches your chosen deployment script
4. **Check ECR permissions** for push access
5. **Verify .env file** has all required production variables

---

## 📊 Report Generation Pipeline

STARAI uses an advanced multi-phase pipeline to generate high-quality case studies from your uploaded documents. Here's how it works:

![Report Generation Pipeline](frontend/src/assets/images/STARAI_Case_Study_Pipeline.png)

---
