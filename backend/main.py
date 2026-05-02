from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
import structlog
from pydantic import BaseModel

from core.telemetry import setup_telemetry
from core.database import init_db
from agents.graph import run_pipeline
from core.celery_app import run_pipeline_task
from routers.webhook import router as webhook_router

logger = structlog.get_logger()

app = FastAPI(title="Sentinel AI", description="Autonomous Multi-Agent Test & Quality Infrastructure")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Telemetry (Prometheus & OpenTelemetry)
setup_telemetry(app)

# Add Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Include GitHub Webhook router
app.include_router(webhook_router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("Sentinel AI started")

class CodeSubmission(BaseModel):
    repo_url: str = ""
    code_content: str
    file_path: str = "main.py"

@app.post("/api/v1/analyze")
async def analyze_code(submission: CodeSubmission):
    """
    Accepts code input (simulate GitHub webhook)
    Runs the LangGraph multi-agent pipeline via Celery.
    """
    logger.info("Received code submission", file_path=submission.file_path)
    
    # Send task to Celery queue
    task = run_pipeline_task.delay(submission.code_content, submission.file_path)
    
    return {"status": "accepted", "task_id": task.id, "message": "Pipeline started in background"}

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
