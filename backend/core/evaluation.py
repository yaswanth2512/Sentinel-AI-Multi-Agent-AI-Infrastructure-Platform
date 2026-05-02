import json
import os
from datetime import datetime
import duckdb
from core.schemas import EvaluationResult, EvaluationMetrics

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
os.makedirs(DB_DIR, exist_ok=True)
DUCKDB_FILE = os.path.join(DB_DIR, "analytics.duckdb")

class ScoringFramework:
    def __init__(self, log_dir=os.path.join(DB_DIR, "eval_logs")):
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)

    def evaluate(self, triage_report: dict, run_id: str = "latest") -> dict:
        severity = triage_report.get("severity", "unknown")
        root_cause = triage_report.get("root_cause", "None")
        
        # Base metrics
        score = 10.0
        confidence = 0.9
        reasoning = "Initial perfect score."

        # Adjust based on severity parsing
        if severity == "high":
            score -= 2.0
            confidence = 0.85
            reasoning = "High severity bugs carry some inherent uncertainty without a sandbox."
        elif severity == "medium":
            score -= 1.0
            confidence = 0.9
            reasoning = "Medium severity bugs are typical and well-understood by the agent."
        elif severity == "unknown":
            score = 0.0
            confidence = 0.4
            reasoning = "Severity unknown, heavily penalizing score."
            
        # Hallucination check (mock logic: if root cause mentions "mock" or "placeholder")
        hallucination_risk = 0.8 if "placeholder" in root_cause.lower() else 0.1
        if hallucination_risk > 0.5:
            confidence -= 0.3
            reasoning += " High hallucination risk detected based on wording."

        eval_obj = EvaluationResult(
            run_id=run_id,
            score=max(0.0, score),
            confidence=max(0.0, confidence),
            metrics=EvaluationMetrics(hallucination_risk=hallucination_risk, tool_misuse=0.0),
            reasoning=reasoning,
            timestamp=datetime.utcnow().isoformat()
        )
        
        evaluation = eval_obj.model_dump()

        self._log_evaluation_json(evaluation)
        self._log_to_duckdb(evaluation)
        return evaluation

    def _log_evaluation_json(self, evaluation: dict):
        log_file = os.path.join(self.log_dir, "evaluations.json")
        try:
            with open(log_file, "r") as f:
                logs = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logs = []
        
        logs.append(evaluation)
        with open(log_file, "w") as f:
            json.dump(logs, f, indent=2)

    def _log_to_duckdb(self, evaluation: dict):
        try:
            con = duckdb.connect(DUCKDB_FILE)
            con.execute("CREATE TABLE IF NOT EXISTS evaluations (run_id VARCHAR, score DOUBLE, confidence DOUBLE, ts TIMESTAMP)")
            con.execute("INSERT INTO evaluations VALUES (?, ?, ?, ?)", 
                        [evaluation["run_id"], evaluation["score"], evaluation["confidence"], evaluation["timestamp"]])
            con.close()
        except Exception as e:
            print(f"Failed to log to DuckDB: {e}")
