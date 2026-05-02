# Sentinel AI Architecture

This document outlines the system architecture of **Sentinel AI**, designed as a robust, resilient AI-infrastructure project for enterprise software quality workflows.

## 1. High-Level Flow (LangGraph State Machine)
The core of the system is modeled as a Directed Acyclic Graph (DAG) using `LangGraph`.

`Input → Parse → Generate Tests → Execute Tests → [Triage || Security Review] → Evaluate → Decision Engine`

By explicitly controlling the state and transitions, we avoid the chaotic, infinite-looping behaviors common in naive Agentic wrappers (like AutoGPT).

## 2. Agent Responsibilities & Structured Outputs

We strictly enforce **Structured Outputs** (via `Pydantic` and `.with_structured_output()`) to guarantee that agents output predictable, machine-readable JSON rather than raw text.

1. **Code Parser Agent**
   - **Responsibility**: Processes large code files using **LibCST** (Concrete Syntax Trees). Prevents context-window overflow by pruning irrelevant lines and extracting function/class signatures.
   - **Output**: `ASTParsingResult` (Schema).

2. **Test Generation & Breaker Agents**
   - **Responsibility**: Ingests the AST. Generates standard unit tests and adversarial boundary tests.

3. **Execution Simulator Agent**
   - **Responsibility**: Acts as a secure sandbox, returning coverage percentages and standard error logs.

4. **Triage Agent (RAG-Enabled)**
   - **Responsibility**: Analyzes failure logs. Uses **ChromaDB + HuggingFace Embeddings** to retrieve past, similar failures to inform the root cause analysis.
   - **Output**: `TriageReport` (Schema: root cause, severity, reproduction steps).

5. **Security Review Agent (Parallelized)**
   - **Responsibility**: Runs simultaneously with Triage. Scans AST for hardcoded secrets, SQLi, and vulnerabilities.
   - **Output**: `SecurityReport` (Schema: top vulnerability, risk level).

6. **Evaluator Agent**
   - **Responsibility**: Calculates a confidence score based on hallucination risks, severity certainty, and historical context. Writes metrics to **DuckDB** for analytics.
   - **Output**: `EvaluationResult` (Schema: score, confidence, reasoning, metrics).

7. **Decision Engine**
   - **Responsibility**: Reads the confidence score. If `confidence >= 0.7`, it automatically issues an API POST request to GitHub to file a bug. If `< 0.7`, it escalates to a human queue.

## 3. The LLM Serving Layer (NVIDIA NIM)
To mimic internal NVIDIA engineering practices, the system uses an abstraction layer over local LLMs.
- It defaults to hitting an **NVIDIA Inference Microservice (NIM)** via an OpenAI-compatible API protocol. This allows blazing-fast inference using models like `Llama-3.1-8B-Instruct`.
- It safely falls back to local execution using `Ollama`.

## 4. Workflows & Async Operations
FastAPI is used purely for API ingress. All heavy LLM operations are routed to an asynchronous background worker queue running on **Celery + Redis**. This ensures the API remains highly available for GitHub webhooks.
