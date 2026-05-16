# Built with Claude Code — Development Workflow

> This document captures how **Sentinel AI** was designed, scaffolded, iterated on, and shipped end-to-end using **[Claude Code](https://claude.ai/code)** (Anthropic's agentic coding tool) as the primary development assistant.

---

## What is Claude Code?

Claude Code is Anthropic's agentic AI coding tool that operates directly inside your terminal. Unlike a chat-based assistant, it can:

- Read, write, and refactor files autonomously
- Execute shell commands and iterate based on output
- Search codebases semantically
- Propose and apply multi-file changes with a single instruction

Sentinel AI was built using Claude Code across every layer of the stack — from the backend agent architecture to the React dashboard and CI/CD pipeline.

---

## How Claude Code Was Used in This Project

### Phase 1 — Architecture & Scaffolding

**Prompt given to Claude Code:**
```
Design a multi-agent LangGraph pipeline in Python for code quality automation.
The pipeline should have 7 specialized agents: Code Parser, Test Gen, Adversarial Breaker,
Execution Simulator, Security Reviewer (run in parallel with Triage), Triage (RAG-enabled),
and Evaluator. Use NVIDIA NIM as primary LLM backend with Ollama fallback.
Scaffold the FastAPI backend, Celery worker, and Pydantic schemas.
```

**What Claude Code generated:**
- Full `backend/` directory with `main.py`, `core/`, `agents/`, `routers/`, and `schemas/`
- `LangGraph` state machine in `core/graph.py` with typed `AgentState`
- `Pydantic` schemas for all 7 agent outputs
- `requirements.txt` with pinned versions

---

### Phase 2 — Agent Implementation

Each agent was built by giving Claude Code the Pydantic output schema and asking it to write the prompt + LangChain chain:

```bash
# Example session logged in Claude Code:
> Implement the Triage Agent.
  It receives a test failure log and uses ChromaDB (collection: "bug_history")
  with HuggingFace embeddings (all-MiniLM-L6-v2) to find the 3 most similar
  past bugs. Output must match TriageReport schema.
```

Claude Code:
1. Wrote `agents/triage_agent.py` with full RAG logic
2. Added ChromaDB initialization in `core/memory.py`
3. Updated `core/graph.py` to wire the Triage node

---

### Phase 3 — Frontend Dashboard

```bash
> Create a React + Tailwind v4 frontend with Vite.
  It should have: a GitHub URL input bar, a live SSE pipeline progress feed
  (7 agent steps with icons and status badges), a score gauge (0–100),
  grade cards for Security / Test Coverage / Code Quality,
  and a collapsible code expander for agent outputs.
  Use a dark theme with NVIDIA green (#76B900) as accent.
```

Claude Code scaffolded the entire `frontend/` in one shot, then iterated
on the SSE streaming logic, animation timing, and mobile responsiveness
across 12 follow-up refinement prompts.

---

### Phase 4 — CI/CD Pipeline

```bash
> Write a GitHub Actions CI/CD pipeline for this project.
  Stages: (1) Ruff lint + format check, (2) pytest with Redis service container
  and Codecov upload, (3) Bandit SAST + pip-audit CVE scan, (4) ESLint +
  TypeScript check + Vite production build, (5) Docker build & push to GHCR,
  (6) Railway deployment on main push. All stages should be gated properly.
```

Claude Code produced the full `.github/workflows/ci.yml` in one pass,
including service containers, artifact uploads, Docker Buildx caching,
and GHCR authentication.

---

### Phase 5 — MCP Server & IDE Integration

Sentinel AI exposes itself as an **MCP (Model Context Protocol) server**, which means
Claude Code itself can call Sentinel AI as a tool during development:

```bash
# Inside Claude Code, connected to sentinel MCP server:
> analyze_repo("https://github.com/my-org/my-service")
# → Claude Code triggers Sentinel AI's 7-agent pipeline and reads the report
```

This created a recursive workflow: Claude Code built Sentinel AI, and Sentinel AI
now integrates back into Claude Code as a quality tool.

---

## Key Metrics from the Claude Code Sessions

| Metric | Value |
|---|---|
| Total Claude Code sessions | ~40+ |
| Files generated or modified by Claude Code | 60+ |
| Lines of code written autonomously | ~4,500 |
| Manual overrides / corrections needed | ~15% |
| Time saved vs. solo development (est.) | ~65–70% |

---

## Lessons Learned

1. **Structured outputs first** — Defining Pydantic schemas before asking Claude Code to implement agents dramatically reduced hallucinations and revision loops.

2. **Iterative prompting > one-shot** — Complex components (like the SSE streaming handler and LangGraph state machine) worked best with 3–5 incremental prompts rather than a single large one.

3. **Let it run commands** — Allowing Claude Code to run `pytest`, `ruff`, and `npm run build` directly after generating code created a tight feedback loop that caught bugs immediately.

4. **MCP as a force multiplier** — Exposing Sentinel AI as an MCP server allowed Claude Code to dog-food its own quality pipeline during later development phases.

---

## How to Replicate This Workflow

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Clone this repo: `git clone https://github.com/yaswanth2512/Sentinel-AI`
3. Start Claude Code in the repo root: `claude`
4. Connect to the MCP server: the MCP config is in `backend/mcp_server.py`

Claude Code will be able to call `analyze_repo`, `get_pipeline_status`, and `get_evaluation_report` as native tools during your development session.

---

*This document was itself written with Claude Code assistance as part of the project's self-documenting architecture.*
