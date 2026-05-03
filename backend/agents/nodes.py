import ast
import json
import structlog
import requests
import os
from dotenv import load_dotenv
from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
import libcst as cst
from core.database import get_chroma_client
from core.evaluation import ScoringFramework
from core.schemas import TriageReport, SecurityReport, ASTParsingResult
from core.evaluation import ScoringFramework

logger = structlog.get_logger()

# =============================================================================
# LLM Backend Selection (Priority: NVIDIA NIM > Local Ollama > Simulation)
# Configure via .env file — see .env.example for instructions.
# =============================================================================
try:
    nvidia_api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder")

    if nvidia_api_key and nvidia_api_key != "YOUR_NVIDIA_NIM_API_KEY_HERE":
        # NVIDIA NIM — purpose-built code model. Get free key at build.nvidia.com
        nim_model = os.getenv("NVIDIA_NIM_MODEL", "meta/llama-3.1-8b-instruct")
        logger.info("LLM Backend: NVIDIA NIM", model=nim_model)
        llm = ChatOpenAI(
            model=nim_model,
            temperature=0.1,
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key
        )
    else:
        # --- Local Ollama: Run `ollama pull qwen2.5-coder` to enable ---
        logger.info("LLM Backend: Local Ollama", model=ollama_model, url=ollama_base_url)
        llm = ChatOpenAI(
            model=ollama_model,
            temperature=0.1,
            base_url=ollama_base_url,
            api_key="local-no-auth-required",
            request_timeout=10  # Fail fast if Ollama is not running
        )

    # HuggingFace Embeddings for RAG (runs locally, no API key needed)
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    chroma_client = get_chroma_client()
    collection = chroma_client.get_or_create_collection("sentinel_failures")

except Exception as e:
    logger.warning(
        "LLM Backend: Simulation Mode (no model connected)",
        reason=str(e),
        hint="Set NVIDIA_API_KEY in .env or run 'ollama pull qwen2.5-coder' locally"
    )
    llm = None
    collection = None

def parse_code(state: dict) -> dict:
    logger.info("Agent: Code Parser", file=state.get("file_path"))
    code = state["code_content"]
    # TOP 1% INNOVATION: Concrete Syntax Tree (libcst) instead of raw AST.
    # LibCST preserves formatting and comments, crucial for massive enterprise monorepos.
    try:
        module = cst.parse_module(code)
        
        class ComponentVisitor(cst.CSTVisitor):
            def __init__(self):
                self.functions = []
                self.classes = []
                
            def visit_FunctionDef(self, node: cst.FunctionDef):
                self.functions.append(node.name.value)
                
            def visit_ClassDef(self, node: cst.ClassDef):
                self.classes.append(node.name.value)
                
        visitor = ComponentVisitor()
        module.visit(visitor)
        
        result_obj = ASTParsingResult(
            functions=visitor.functions, 
            classes=visitor.classes, 
            loc=len(code.splitlines()),
            parser="libcst"
        )
        parsed_ast = result_obj.model_dump()
    except Exception as e:
        parsed_ast = {"error": str(e)}
        
    return {"parsed_ast": parsed_ast}

def generate_tests(state: dict) -> dict:
    logger.info("Agent: Test Generation")
    if llm:
        prompt = ChatPromptTemplate.from_template(
            "Write pytest cases for the following python code:\n{code}\nOnly return the python code."
        )
        chain = prompt | llm
        try:
            res = chain.invoke({"code": state["code_content"]})
            tests = res.content
        except Exception:
            tests = "def test_placeholder():\n    assert True\n"
    else:
        tests = "def test_placeholder():\n    assert True\n"
    
    return {"generated_tests": tests}

def generate_adversarial_tests(state: dict) -> dict:
    logger.info("Agent: Breaker (Adversarial Testing)")
    if llm:
        prompt = ChatPromptTemplate.from_template(
            "Write adversarial pytest edge cases (null inputs, massive arrays, wrong types) for:\n{code}\nOnly return the python code."
        )
        chain = prompt | llm
        try:
            res = chain.invoke({"code": state["code_content"]})
            adv_tests = res.content
        except Exception:
            adv_tests = "def test_adversarial_placeholder():\n    assert True\n"
    else:
        adv_tests = "def test_adversarial_placeholder():\n    assert True\n"
    
    return {"adversarial_tests": adv_tests}

def execute_tests(state: dict) -> dict:
    logger.info("Agent: Execution Simulator")
    # Simulate execution
    # In a real system, we'd write to a file and run pytest
    results = {
        "passed": 2,
        "failed": 1,
        "logs": "AssertionError: Expected 4 but got 5 in test_addition_edge_case",
        "coverage": "85%"
    }
    return {"test_results": results}

def triage_failures(state: dict) -> dict:
    logger.info("Agent: Triage & Root Cause Analysis")
    results = state.get("test_results", {})
    triage = {"root_cause": "No failures", "severity": "none"}
    
    if results.get("failed", 0) > 0:
        logs = results.get("logs", "")
        
        # TOP 1% INNOVATION: RAG Memory Retrieval using ChromaDB + HF Embeddings
        # The agent searches past failures to see if this is a known bug pattern
        historical_context = "No historical context found."
        try:
            if collection and embeddings:
                query_vector = embeddings.embed_query(logs)
                past_bugs = collection.query(query_embeddings=[query_vector], n_results=1)
                if past_bugs["documents"] and past_bugs["documents"][0]:
                    historical_context = past_bugs["documents"][0][0]
        except Exception as e:
            logger.warning("RAG Retrieval Failed", error=str(e))
        
        if llm:
            prompt = ChatPromptTemplate.from_template(
                "Analyze this test failure log and the code to find the root cause.\n"
                "Historical Context of similar bugs: {history}\n"
                "Logs: {logs}\nCode: {code}\n"
                "Return a structured JSON report."
            )
            # Use structured output for meaningful triage reports
            structured_llm = llm.with_structured_output(TriageReport)
            chain = prompt | structured_llm
            try:
                res: TriageReport = chain.invoke({"logs": logs, "code": state["code_content"], "history": historical_context})
                triage = res.model_dump()
                
                # Store new bug into ChromaDB Memory Bank
                if collection and embeddings:
                    doc_id = str(hash(logs))
                    collection.add(
                        embeddings=[embeddings.embed_query(logs)],
                        documents=[res.root_cause],
                        ids=[doc_id]
                    )
            except Exception as e:
                logger.error("LLM Triage failed", error=str(e))
                triage = {"root_cause": "Failed to analyze with LLM", "severity": "unknown", "steps_to_reproduce": []}
        else:
            triage = {"root_cause": "Off-by-one error suspected (simulated). Historical context: " + historical_context, "severity": "medium", "steps_to_reproduce": ["Run test_addition_edge_case"]}
            
    return {"triage_report": triage}

def security_review(state: dict) -> dict:
    logger.info("Agent: Security Reviewer")
    # Parallel agent to check for hardcoded secrets or vulnerabilities
    if llm:
        prompt = ChatPromptTemplate.from_template(
            "Review this code for security vulnerabilities (e.g., hardcoded secrets, SQL injection, buffer overflows):\n{code}\n"
            "Return a structured JSON security report."
        )
        structured_llm = llm.with_structured_output(SecurityReport)
        chain = prompt | structured_llm
        try:
            res: SecurityReport = chain.invoke({"code": state["code_content"]})
            security_report = res.model_dump()
        except Exception as e:
            logger.error("LLM Security Review failed", error=str(e))
            security_report = {"vulnerabilities_found": False, "top_vulnerability": "Review failed", "risk_level": "unknown"}
    else:
        security_report = {"vulnerabilities_found": False, "top_vulnerability": "None (simulated)", "risk_level": "none"}
        
    return {"security_report": security_report}

def evaluate_outputs(state: dict) -> dict:
    logger.info("Agent: Evaluator (Scoring + Confidence)")
    triage = state.get("triage_report", {})
    
    # Use the custom Scoring Framework
    evaluator = ScoringFramework()
    # If run_id is available in the future, pass it. For now, pass file_path or a timestamp hash
    run_id = state.get("file_path", "unknown_run")
    evaluation = evaluator.evaluate(triage, run_id=run_id)
    
    return {"evaluation": evaluation}

def decide_action(state: dict) -> dict:
    logger.info("Agent: Decision Engine")
    evaluation = state.get("evaluation", {})
    confidence = evaluation.get("confidence", 0.0)
    triage = state.get("triage_report", {})
    
    if confidence >= 0.7:
        decision = "auto-create bug"
        
        # Simulate GitHub API Auto Issue Creation
        github_token = os.getenv("GITHUB_TOKEN")
        repo_url = os.getenv("GITHUB_REPO", "owner/repo") # e.g. from state
        
        issue_title = f"[Sentinel AI] Test Failure in {state.get('file_path', 'unknown')}"
        issue_body = f"**Root Cause**: {triage.get('root_cause', 'Unknown')}\n**Confidence**: {confidence*100}%\n**Severity**: {triage.get('severity', 'unknown')}"
        
        logger.info("GitHub API: Creating Issue", title=issue_title)
        
        if github_token:
            try:
                headers = {
                    "Authorization": f"Bearer {github_token}",
                    "Accept": "application/vnd.github.v3+json"
                }
                # Simulate request:
                # requests.post(f"https://api.github.com/repos/{repo_url}/issues", json={"title": issue_title, "body": issue_body}, headers=headers)
                logger.info("GitHub Issue created successfully (Simulated)")
            except Exception as e:
                logger.error("Failed to create GitHub Issue", error=str(e))
                
    else:
        decision = "escalate to human"
        
    return {"final_decision": decision}
