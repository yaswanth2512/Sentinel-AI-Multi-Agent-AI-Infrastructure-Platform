"""
Sentinel AI — Benchmark & Metrics Reporter
==========================================
Run this script to generate real, measurable performance statistics from the pipeline.
These numbers can be cited in your resume and README.

Usage:
    cd /path/to/NVIDIA
    python benchmark.py
"""

import sys
import os
import time
import json
import statistics
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from core.database import init_db
from agents.graph import run_pipeline

# ---------------------------------------------------------------------------
# Test cases — a mix of buggy and clean code to generate realistic stats
# ---------------------------------------------------------------------------
TEST_CASES = [
    {
        "name": "Division Bug",
        "file": "math_utils.py",
        "code": """
def calculate_discount(price, discount):
    # Bug: divides instead of subtracts
    return price / discount
"""
    },
    {
        "name": "Off-By-One Error",
        "file": "list_utils.py",
        "code": """
def get_last_item(items):
    return items[len(items)]  # Bug: should be len-1
"""
    },
    {
        "name": "Type Mismatch",
        "file": "user_service.py",
        "code": """
def get_user_age(user):
    return user["age"] + "years"  # Bug: int + str
"""
    },
    {
        "name": "Clean Function",
        "file": "string_utils.py",
        "code": """
def reverse_string(s: str) -> str:
    return s[::-1]
"""
    },
    {
        "name": "Security Concern",
        "file": "auth.py",
        "code": """
SECRET_KEY = "hardcoded-secret-123"

def authenticate(token):
    return token == SECRET_KEY
"""
    },
    {
        "name": "Recursive Without Base Case",
        "file": "fib.py",
        "code": """
def fibonacci(n):
    return fibonacci(n - 1) + fibonacci(n - 2)
"""
    },
]


def run_benchmark():
    print("=" * 60)
    print("Sentinel AI — Performance Benchmark")
    print(f"Run started at: {datetime.utcnow().isoformat()}Z")
    print("=" * 60)

    init_db()

    latencies = []
    results_summary = []
    failures_detected = 0
    errors = 0

    for i, test in enumerate(TEST_CASES, 1):
        print(f"\n[{i}/{len(TEST_CASES)}] Running: {test['name']} ({test['file']})")
        start = time.perf_counter()

        try:
            result = run_pipeline(test["code"], test["file"])
            elapsed = time.perf_counter() - start
            latencies.append(elapsed)

            triage = result.get("triage_report", {})
            evaluation = result.get("evaluation", {})
            test_results = result.get("test_results", {})

            failed = test_results.get("failed", 0)
            if failed > 0:
                failures_detected += 1

            summary = {
                "test": test["name"],
                "file": test["file"],
                "latency_s": round(elapsed, 3),
                "severity": triage.get("severity", "none"),
                "confidence": evaluation.get("confidence", 0),
                "score": evaluation.get("score", 0),
                "decision": result.get("final_decision", "n/a"),
                "tests_passed": test_results.get("passed", 0),
                "tests_failed": test_results.get("failed", 0),
                "coverage": test_results.get("coverage", "0%"),
            }
            results_summary.append(summary)
            print(f"  Latency: {elapsed:.2f}s | Severity: {triage.get('severity')} | "
                  f"Confidence: {evaluation.get('confidence', 0):.0%} | Decision: {result.get('final_decision')}")

        except Exception as e:
            errors += 1
            elapsed = time.perf_counter() - start
            print(f"  ERROR: {e}")

    # -------------------------------------------------------------------------
    # Aggregate Statistics
    # -------------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)

    if latencies:
        avg_latency = statistics.mean(latencies)
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]
        min_latency = min(latencies)
        max_latency = max(latencies)

        success_rate = ((len(TEST_CASES) - errors) / len(TEST_CASES)) * 100
        failure_detection_rate = (failures_detected / len(TEST_CASES)) * 100
        avg_confidence = statistics.mean(
            [r["confidence"] for r in results_summary if r["confidence"] > 0]
        )
        avg_score = statistics.mean(
            [r["score"] for r in results_summary if r["score"] > 0]
        )

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_runs": len(TEST_CASES),
            "pipeline_success_rate_pct": round(success_rate, 1),
            "failure_detection_rate_pct": round(failure_detection_rate, 1),
            "avg_pipeline_latency_s": round(avg_latency, 3),
            "p95_pipeline_latency_s": round(p95_latency, 3),
            "min_latency_s": round(min_latency, 3),
            "max_latency_s": round(max_latency, 3),
            "avg_confidence_score": round(avg_confidence, 3),
            "avg_evaluation_score": round(avg_score, 2),
            "errors": errors,
            "results": results_summary
        }

        print(f"  Total pipeline runs      : {report['total_runs']}")
        print(f"  Pipeline success rate    : {report['pipeline_success_rate_pct']}%")
        print(f"  Failure detection rate   : {report['failure_detection_rate_pct']}%")
        print(f"  Avg pipeline latency     : {report['avg_pipeline_latency_s']}s")
        print(f"  P95 pipeline latency     : {report['p95_pipeline_latency_s']}s")
        print(f"  Avg confidence score     : {report['avg_confidence_score']:.2%}")
        print(f"  Avg evaluation score     : {report['avg_evaluation_score']}/10")

        # Save report
        os.makedirs("eval_logs", exist_ok=True)
        report_path = f"eval_logs/benchmark_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        print(f"\n  Full report saved to: {report_path}")
        print("\nResume-ready metrics:")
        print(f"  - Achieved {report['failure_detection_rate_pct']}% bug detection rate across diverse code samples")
        print(f"  - End-to-end pipeline executes in {report['avg_pipeline_latency_s']}s avg ({report['p95_pipeline_latency_s']}s P95)")
        print(f"  - Maintained {report['pipeline_success_rate_pct']}% pipeline reliability across all test scenarios")
        print(f"  - Evaluation engine produces {report['avg_confidence_score']:.0%} avg confidence with explainable reasoning")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    run_benchmark()
