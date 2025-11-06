# main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
import logging
import sys
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

from app.routes import case_routes, document_routes, user_routes, chunk_routes, report_routes, template_routes, slide_routes
from app.database.connection import create_indexes, reset_database

# Initialize FastAPI app
from dotenv import load_dotenv
load_dotenv()

# Set ROOT_URL_BACKEND based on PROJECT_VARIANT
PROJECT_VARIANT = os.environ.get('PROJECT_VARIANT')
if PROJECT_VARIANT == 'sof':
    ROOT_URL_BACKEND = os.environ.get('SOF_URL', '')
elif PROJECT_VARIANT == 'report':
    ROOT_URL_BACKEND = os.environ.get('REPORT_URL', '')
elif PROJECT_VARIANT == 'custom':
    ROOT_URL_BACKEND = os.environ.get('CUSTOM_URL', '')
else:
    ROOT_URL_BACKEND = ""

APP_ENV = os.environ.get('APP_ENV')
app = FastAPI(root_path=ROOT_URL_BACKEND)


# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust as needed for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # reset_database()
    create_indexes()
    print("Startup event: Upload directories and DB indexes initialized.")

# --- API ROUTERS ---

# Authentication and User Routes
app.include_router(user_routes.router, prefix="/api/auth", tags=["Authentication"])

# Admin User Management Routes
app.include_router(user_routes.admin_router, prefix="/api", tags=["Admin"])

# Other Application Routes
app.include_router(case_routes.router, prefix="/api/cases")
app.include_router(document_routes.router, prefix="/api/cases/{case_id}/documents")  # Nested document routes under a case
app.include_router(template_routes.router, prefix="/api/custom/documents")  # Custom document routes
app.include_router(chunk_routes.router, prefix="/api/cases/{case_id}/documents/{doc_id}")
app.include_router(report_routes.router, prefix="/api/reports", tags=["Reports"])
app.include_router(slide_routes.router, prefix="/api/slides", tags=["Slides"])

if APP_ENV == "production" or APP_ENV == "test":
    # Serve React static files
    frontend_build_path = "/app/frontend/dist"  # Direct path in container
    if os.path.exists(frontend_build_path):
        # Mount static assets
        app.mount("/assets", StaticFiles(directory=os.path.join(frontend_build_path, "assets")), name="assets")

        # Specific routes for root static files
        @app.get("/favicon.ico")
        async def favicon():
            return FileResponse(os.path.join(frontend_build_path, "favicon.ico"))

        @app.get("/manifest.json")
        async def manifest():
            return FileResponse(os.path.join(frontend_build_path, "manifest.json"))

        @app.get("/robots.txt")
        async def robots():
            return FileResponse(os.path.join(frontend_build_path, "robots.txt"))

    if os.path.exists(frontend_build_path):
        # Catch-all route for React Router - must be last
        @app.get("/{full_path:path}")
        async def serve_react_app(full_path: str):
            # Skip API routes and static files - let FastAPI handle 404s
            if full_path.startswith("api/") or full_path.startswith("assets/") or full_path.startswith("temp-audio/") or full_path in ["favicon.ico", "manifest.json", "robots.txt"]:
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Not found")
            
            # Serve React index.html for all other routes
            return FileResponse(os.path.join(frontend_build_path, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True, log_level="debug", ws="websockets")