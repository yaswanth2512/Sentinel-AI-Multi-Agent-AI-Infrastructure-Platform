# Known Limitations & Failure Modes

Building agentic workflows requires intellectual integrity regarding where systems break and how to recover. Here are the known limitations of Sentinel AI and how the system attempts to mitigate them:

## 1. LLM Hallucinations in Test Generation
**Failure Mode**: The Test Generation Agent or Breaker Agent might write syntactically invalid Python code or reference mock objects that don't exist.
**Mitigation**: The Execution Simulator acts as a sandbox. If tests fail due to syntax errors rather than logical failures, the Triage agent identifies this as a "Bad Test" rather than a "Bug in Code". The system applies a retry loop in LangGraph up to 3 times to correct test syntax.

## 2. Context Window Limits
**Failure Mode**: Very large files or massive monorepo PRs exceed the context limits of local models (e.g., Qwen2.5-Coder).
**Mitigation**: The Code Parser Agent uses AST (Python `ast` / `tree-sitter`) to prune the input. Only relevant function signatures, docstrings, and changed lines are passed to the downstream agents, preserving context tokens.

## 3. Tool Misuse & Endless Loops
**Failure Mode**: The LangGraph state machine could get stuck in an endless loop between Triage -> Fix -> Test if a bug is unfixable.
**Mitigation**: A strict `retries` counter is enforced in the `AgentState`. Once `retries > 3`, the execution graph forces an exit to the `decide_action` node, which will mark confidence as low and escalate to a human.

## 4. Local Inference Latency
**Failure Mode**: Running multiple LLM calls sequentially on Ollama locally is slow, leading to high pipeline latency.
**Mitigation**: The system is designed to use background tasks (FastAPI `BackgroundTasks` / Celery). The API returns an immediate `202 Accepted`, and the UI polls for state or relies on webhooks. 

## 5. Non-Deterministic Evaluation
**Failure Mode**: The Evaluator Agent might score the same failure differently across runs.
**Mitigation**: DuckDB is used to store historical evaluation metrics. Future iterations will compute a rolling average of agent scores and flag evaluations that deviate > 20% from historical norms for similar AST structures (queried via ChromaDB).
