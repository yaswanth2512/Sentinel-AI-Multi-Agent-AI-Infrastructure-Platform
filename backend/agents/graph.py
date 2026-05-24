from typing import TypedDict, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END

from agents.nodes import (
    parse_code,
    generate_tests,
    generate_adversarial_tests,
    execute_tests,
    triage_failures,
    security_review,
    evaluate_outputs,
    decide_action
)

# Define State
class AgentState(TypedDict):
    code_content: str
    file_path: str
    parsed_ast: Optional[Dict[str, Any]] # We keep dict for compatibility but will pass Pydantic dicts
    generated_tests: Optional[str]
    adversarial_tests: Optional[str]
    test_results: Optional[Dict[str, Any]]
    triage_report: Optional[Dict[str, Any]]
    security_report: Optional[Dict[str, Any]]
    evaluation: Optional[Dict[str, Any]]
    final_decision: Optional[str]
    error: Optional[str]
    retries: int

def run_pipeline(code_content: str, file_path: str):
    # Build Graph
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("parse_code", parse_code)
    workflow.add_node("generate_tests", generate_tests)
    workflow.add_node("generate_adversarial_tests", generate_adversarial_tests)
    workflow.add_node("execute_tests", execute_tests)
    workflow.add_node("triage_failures", triage_failures)
    workflow.add_node("security_review", security_review)
    workflow.add_node("evaluate_outputs", evaluate_outputs)
    workflow.add_node("decide_action", decide_action)

    # Define Edges — fully sequential for reliable 480B model execution
    workflow.add_edge(START, "parse_code")
    workflow.add_edge("parse_code", "generate_tests")
    workflow.add_edge("generate_tests", "generate_adversarial_tests")
    workflow.add_edge("generate_adversarial_tests", "execute_tests")
    workflow.add_edge("execute_tests", "triage_failures")
    workflow.add_edge("triage_failures", "security_review")
    workflow.add_edge("security_review", "evaluate_outputs")
    workflow.add_edge("evaluate_outputs", "decide_action")
    workflow.add_edge("decide_action", END)

    app = workflow.compile()

    # Initial State
    state = AgentState(
        code_content=code_content,
        file_path=file_path,
        parsed_ast=None,
        generated_tests=None,
        adversarial_tests=None,
        test_results=None,
        triage_report=None,
        evaluation=None,
        final_decision=None,
        error=None,
        retries=0
    )

    try:
        final_state = app.invoke(state)
        return final_state
    except Exception as e:
        print(f"Pipeline failed: {e}")
        return {"error": str(e)}


# Mapping from LangGraph node names to frontend-friendly agent names
NODE_DISPLAY_NAMES = {
    "parse_code": "Parser",
    "generate_tests": "Test Gen",
    "generate_adversarial_tests": "Breaker",
    "execute_tests": "Execute",
    "triage_failures": "Triage",
    "security_review": "Security",
    "evaluate_outputs": "Evaluate",
    "decide_action": "Decision",
}


def stream_pipeline(code_content: str, file_path: str):
    """
    Generator that yields real-time progress events as each LangGraph node completes.
    Used by the SSE endpoint for live pipeline visualization.
    """
    workflow = StateGraph(AgentState)

    workflow.add_node("parse_code", parse_code)
    workflow.add_node("generate_tests", generate_tests)
    workflow.add_node("generate_adversarial_tests", generate_adversarial_tests)
    workflow.add_node("execute_tests", execute_tests)
    workflow.add_node("triage_failures", triage_failures)
    workflow.add_node("security_review", security_review)
    workflow.add_node("evaluate_outputs", evaluate_outputs)
    workflow.add_node("decide_action", decide_action)

    workflow.add_edge(START, "parse_code")
    workflow.add_edge("parse_code", "generate_tests")
    workflow.add_edge("generate_tests", "generate_adversarial_tests")
    workflow.add_edge("generate_adversarial_tests", "execute_tests")
    workflow.add_edge("execute_tests", "triage_failures")
    workflow.add_edge("triage_failures", "security_review")
    workflow.add_edge("security_review", "evaluate_outputs")
    workflow.add_edge("evaluate_outputs", "decide_action")
    workflow.add_edge("decide_action", END)

    app = workflow.compile()

    state = AgentState(
        code_content=code_content,
        file_path=file_path,
        parsed_ast=None,
        generated_tests=None,
        adversarial_tests=None,
        test_results=None,
        triage_report=None,
        evaluation=None,
        final_decision=None,
        error=None,
        retries=0
    )

    final_state = state
    for event in app.stream(state):
        # event is a dict like {"parse_code": {updated state fields}}
        for node_name, node_output in event.items():
            display_name = NODE_DISPLAY_NAMES.get(node_name, node_name)
            final_state = {**final_state, **node_output}
            yield {
                "type": "agent_complete",
                "agent": display_name,
                "node": node_name,
            }

    yield {
        "type": "pipeline_complete",
        "result": final_state,
    }
