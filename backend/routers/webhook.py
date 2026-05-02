import structlog
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
import hmac
import hashlib
import os

from core.celery_app import run_pipeline_task

logger = structlog.get_logger()
router = APIRouter()

# Optional: Add your GitHub webhook secret here
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")

def verify_signature(payload_body: bytes, signature_header: str) -> bool:
    if not GITHUB_WEBHOOK_SECRET:
        return True # Skip verification if no secret is configured
        
    if not signature_header:
        return False
        
    hash_object = hmac.new(
        GITHUB_WEBHOOK_SECRET.encode("utf-8"),
        msg=payload_body,
        digestmod=hashlib.sha256
    )
    expected_signature = "sha256=" + hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)

@router.post("/webhook/github")
async def github_webhook(request: Request):
    """
    Listens for GitHub Push / PR triggers.
    """
    payload_body = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256")
    
    if not verify_signature(payload_body, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")

    event_type = request.headers.get("X-GitHub-Event")
    payload = await request.json()
    
    logger.info("Received GitHub Webhook", event=event_type)

    if event_type == "pull_request" and payload.get("action") in ["opened", "synchronize"]:
        # Extract repository info and trigger analysis
        repo_url = payload.get("pull_request", {}).get("head", {}).get("repo", {}).get("clone_url", "")
        # In a real scenario, you would fetch the diff or the files from the PR here.
        # For simulation, we pass a dummy code snippet representing the changed file.
        changed_code = "def sample_diff():\n    return 'changed'"
        file_path = "src/sample.py"
        
        task = run_pipeline_task.delay(changed_code, file_path)
        logger.info("Triggered PR Pipeline", task_id=task.id)
        return {"status": "analyzing PR", "task_id": task.id}

    elif event_type == "push":
        repo_url = payload.get("repository", {}).get("clone_url", "")
        # Simulate taking the last commit changes
        changed_code = "def sample_push():\n    return 'push_change'"
        task = run_pipeline_task.delay(changed_code, "main.py")
        logger.info("Triggered Push Pipeline", task_id=task.id)
        return {"status": "analyzing Push", "task_id": task.id}

    return {"status": "ignored event type"}
