from celery import Celery
import os
from agents.graph import run_pipeline

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "sentinel_tasks",
    broker=redis_url,
    backend=redis_url
)

# Optional config
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@celery_app.task(name="sentinel.run_pipeline")
def run_pipeline_task(code_content: str, file_path: str):
    """
    Background task to execute the full LangGraph pipeline.
    """
    return run_pipeline(code_content, file_path)
