# Sentinel AI

<div align="center">
  <p><strong>Autonomous Multi-Agent Test & Quality Infrastructure Platform</strong></p>
  <p><em>Built to simulate enterprise-grade AI infrastructure for code quality and evaluation.</em></p>
</div>

<hr />

## 📖 Overview

**Sentinel AI** is a production-grade multi-agent orchestration platform designed to automate test generation, adversarial testing, failure triage, and bug-filing workflows. Built with an infrastructure-first mindset, it demonstrates how Large Language Models (LLMs) can be reliably integrated into engineering pipelines with robust failure recovery, observability, and evaluation logic.

This project was built to explore how AI agents can operate safely within massive enterprise monorepos. 

### Key Innovations

- **Retrieval-Augmented Generation (RAG) Memory**: The Triage Agent uses **ChromaDB** and HuggingFace embeddings (`all-MiniLM-L6-v2`) to cross-reference new test failures with historical bugs. It learns from past CI/CD failures over time.
- **Concrete Syntax Tree Parsing**: Uses Meta's **LibCST** instead of standard Python ASTs. This preserves code formatting and comments—crucial for programmatic transformations in large-scale codebases.
- **Enterprise LLM Scalability (NVIDIA NIM)**: Designed using an OpenAI-compatible API layer, allowing the system to natively hit **NVIDIA Inference Microservices (NIM)** for ultra-low latency execution using powerful lightweight models like `Llama-3.1-8B` or `Nemotron-Mini-4B`. It safely falls back to local `Ollama` if no NIM endpoint is available.
- **Inter-Agent MCP Communication**: Designed so agents can dynamically request tools via the Model Context Protocol (MCP), ensuring seamless communication and shared context between the Security and Triage agents.
- **Automated Evaluation Systems**: A custom `ScoringFramework` logs agent performance, hallucination risks, and confidence metrics into a **DuckDB** analytics engine. 

---

## Architecture & Tech Stack

### Agent & LLM Layer
- **LangGraph & LangChain**: For complex state-machine orchestration and agent tool abstraction.
- **NVIDIA NIM & Ollama**: Prioritizes `meta/llama-3.1-8b-instruct` via NVIDIA NIM API for blazing-fast inference, falling back to local `qwen2.5-coder`.
- **7-Agent Architecture**: Includes Code Parser, Test Gen, Adversarial Breaker, Execution Simulator, Security Reviewer (parallel execution), Triage, and Evaluator.

### Code Understanding & Testing
- **LibCST & tree-sitter**: Concrete syntax tree and AST parsing for deep code understanding.
- **pytest & coverage.py**: Automated test generation and test execution coverage tracking.

### Core Infrastructure
- **Python 3.11+ / FastAPI / Pydantic**: Robust backend API architecture.
- **Celery + Redis**: Asynchronous background task queues for running the pipelines without blocking the API.
- **LibCST**: Advanced concrete syntax tree parsing.

### Data & Evaluation Layer
- **DuckDB**: Fast analytical engine for evaluation metrics.
- **ChromaDB**: Vector database for RAG failure memory.
- **SQLite**: Local persistence for agent execution state and runs.
- **Custom Scoring Framework**: Python module generating JSON-based evaluation logs and confidence scoring.

### Observability & DevOps
- **OpenTelemetry & Prometheus**: Distributed tracing and metrics collection.
- **structlog**: Structured JSON logging across the agent lifecycle.
- **Docker**: Containerized infrastructure orchestration.
- **GitHub Actions**: Automated CI/CD testing pipelines.

### Frontend UI
- **React (Next.js/Vite) + Tailwind CSS v4**: Clean, dynamic dashboard UI.
- **Chart.js / Recharts**: High-quality metrics and visualization components.

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- [Ollama](https://ollama.com/) (Optional: for running the local `qwen2.5-coder` model. The system will safely fallback if not available).

### 1. Start Core Infrastructure (Redis & Prometheus)
```bash
docker-compose up -d
```

### 2. Run the Backend & Celery Worker
Open a terminal and navigate to the `backend` directory.

```bash
# Install dependencies
pip install -r requirements.txt

# Start the FastAPI Server
uvicorn main:app --reload --port 8000

# (In a new terminal) Start the Celery Worker
celery -A core.celery_app worker --loglevel=info
```

### 3. Start the Frontend Dashboard
Open a new terminal and navigate to the `frontend` directory.

```bash
npm install
npm run dev
```

The application UI will be available at `http://localhost:5173/`.

---

## Usage & Integrations

### CLI Tool
You can trigger the pipeline directly via the command line tool without needing the UI:
```bash
cd backend
python cli.py run https://github.com/my-org/my-repo
```

### GitHub Webhooks
Sentinel AI includes a secure router (`backend/routers/webhook.py`) that uses HMAC SHA-256 to listen to GitHub Pull Request and Push events. When triggered, the code is passed to the background Celery queue for analysis.

### MCP Server (Model Context Protocol)
Sentinel includes an MCP Server (`backend/mcp_server.py`) that exposes the entire LangGraph orchestration pipeline directly to modern IDEs like **Cursor** and **Claude Code**.

---

## Intellectual Integrity & Limitations
Building autonomous systems requires understanding where they fail. Please see [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for a detailed breakdown of failure modes (like context window limits, LLM hallucinations, and infinite loops) and how Sentinel AI programmatically mitigates them.
