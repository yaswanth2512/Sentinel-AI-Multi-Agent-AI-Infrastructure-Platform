import sys
import os
import json

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from core.database import init_db
from agents.graph import run_pipeline

code_snippet = """
def calculate_discount(price, discount):
    # Intentional bug: dividing instead of subtracting
    return price / discount
"""

if __name__ == "__main__":
    print("Initializing databases (SQLite, DuckDB, ChromaDB)...")
    init_db()
    
    print("\nRunning Sentinel AI Pipeline on sample code snippet...")
    print("Code Snippet:")
    print("---------------------------------")
    print(code_snippet.strip())
    print("---------------------------------\n")
    
    result = run_pipeline(code_snippet, "sales_utils.py")

    if isinstance(result, dict) and "error" in result:
        print(f"❌ Pipeline failed: {result['error']}")
        sys.exit(1)

    print("\nPIPELINE COMPLETED! Here are the agent outputs:\n")
    
    if result.get("parsed_ast"):
        print("[1] CODE PARSER AGENT:")
        print(json.dumps(result["parsed_ast"], indent=2))
        print()
        
    if result.get("generated_tests"):
        print("[2] TEST GENERATION AGENT:")
        print(result["generated_tests"])
        print()

    if result.get("test_results"):
        print("[3] EXECUTION SIMULATOR:")
        print(json.dumps(result["test_results"], indent=2))
        print()

    if result.get("triage_report"):
        print("[4] TRIAGE AGENT:")
        print(json.dumps(result["triage_report"], indent=2))
        print()

    if result.get("evaluation"):
        print("[5] EVALUATOR AGENT (DuckDB metrics logged):")
        print(json.dumps(result["evaluation"], indent=2))
        print()

    if result.get("final_decision"):
        print("[6] DECISION ENGINE:")
        action = result['final_decision']
        print(f"Action Taken: {action.upper()}")
        if "auto-create bug" in action:
            print(">> GitHub API triggered to auto-file ticket.")
        else:
            print(">> Flagged for human review.")
