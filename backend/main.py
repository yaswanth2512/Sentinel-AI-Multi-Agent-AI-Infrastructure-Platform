from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
import structlog
import requests as http_requests
import os
from pydantic import BaseModel
from typing import Optional

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

class RepoSubmission(BaseModel):
    github_url: str
    max_files: int = 3  # Limit files analysed to avoid timeouts on free tiers

@app.post("/api/v1/analyze")
async def analyze_code(submission: CodeSubmission):
    """Runs the full pipeline on raw submitted code and returns results synchronously."""
    logger.info("Received code submission", file_path=submission.file_path)
    result = run_pipeline(submission.code_content, submission.file_path)
    return {"status": "completed", "result": result}

@app.post("/api/v1/analyze-repo")
async def analyze_repo(submission: RepoSubmission):
    """
    Accepts a GitHub repository URL, fetches Python files via the GitHub API,
    runs the full LangGraph multi-agent pipeline on each file, and returns
    structured results including triage reports, security findings, and
    evaluation scores.
    """
    github_url = submission.github_url.rstrip("/")
    logger.info("Received repo submission", url=github_url)

    # Parse owner/repo from URL
    try:
        parts = github_url.replace("https://github.com/", "").split("/")
        owner, repo = parts[0], parts[1]
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid GitHub URL. Format: https://github.com/owner/repo")

    # Fetch repo file tree via GitHub API
    github_token = os.getenv("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if github_token and github_token != "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN_HERE":
        headers["Authorization"] = f"token {github_token}"

    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
    tree_resp = http_requests.get(tree_url, headers=headers, timeout=10)
    if tree_resp.status_code != 200:
        raise HTTPException(status_code=404, detail=f"Could not access GitHub repo: {github_url}. Make sure it is public.")

    tree = tree_resp.json().get("tree", [])
    python_files = [
        f for f in tree
        if f["type"] == "blob" and f["path"].endswith(".py")
        and not any(skip in f["path"] for skip in ["__pycache__", "test_", ".egg", "migrations"])
    ][:submission.max_files]

    if not python_files:
        raise HTTPException(status_code=422, detail="No analysable Python files found in repository.")

    # Fetch and analyse each file
    analysis_results = []
    for file_info in python_files:
        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{file_info['path']}"
        code_resp = http_requests.get(raw_url, timeout=10)
        if code_resp.status_code != 200:
            continue

        code = code_resp.text
        if len(code) > 8000:  # Truncate very large files to stay within context window
            code = code[:8000] + "\n# ... (truncated for context window)"

        logger.info("Analysing file", file=file_info["path"])
        result = run_pipeline(code, file_info["path"])
        analysis_results.append({
            "file": file_info["path"],
            "result": result
        })

    return {
        "status": "completed",
        "repo": f"{owner}/{repo}",
        "files_analysed": len(analysis_results),
        "results": analysis_results
    }

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "message": "Sentinel AI backend is running"}
