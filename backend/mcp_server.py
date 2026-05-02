from mcp.server.fastmcp import FastMCP
from agents.graph import run_pipeline
import asyncio

# Initialize FastMCP Server
mcp = FastMCP("SentinelAI")

@mcp.tool()
def analyze_code_for_bugs(code: str, file_path: str = "main.py") -> str:
    """
    Analyze code using the Sentinel AI multi-agent pipeline.
    This simulates a GitHub webhook running automated test generation, 
    failure triage, and bug-filing workflows.
    """
    result = run_pipeline(code, file_path)
    return str(result)

if __name__ == "__main__":
    mcp.run_stdio_async()
