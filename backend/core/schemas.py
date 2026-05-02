from pydantic import BaseModel, Field
from typing import List, Optional

class ASTParsingResult(BaseModel):
    functions: List[str] = Field(description="List of function names found in the code")
    classes: List[str] = Field(description="List of class names found in the code")
    loc: int = Field(description="Lines of code count")
    parser: str = Field(description="The parser used, e.g., 'libcst'")
    error: Optional[str] = Field(None, description="Error message if parsing failed")

class TriageReport(BaseModel):
    root_cause: str = Field(description="Detailed explanation of why the test failed")
    severity: str = Field(description="Severity of the issue: high, medium, low")
    steps_to_reproduce: List[str] = Field(description="Steps to reproduce the bug")

class SecurityReport(BaseModel):
    vulnerabilities_found: bool = Field(description="Whether any vulnerabilities were found")
    top_vulnerability: str = Field(description="Description of the top vulnerability, or 'None'")
    risk_level: str = Field(description="Risk level: critical, high, medium, low, none")

class EvaluationMetrics(BaseModel):
    hallucination_risk: float = Field(description="Score from 0.0 to 1.0 indicating risk of hallucinated root cause")
    tool_misuse: float = Field(description="Score from 0.0 to 1.0 indicating tool misuse")

class EvaluationResult(BaseModel):
    run_id: str
    score: float = Field(description="Overall evaluation score from 0.0 to 10.0")
    confidence: float = Field(description="Confidence in the triage report from 0.0 to 1.0")
    metrics: EvaluationMetrics
    reasoning: str = Field(description="Explanation of why this score and confidence were given")
    timestamp: str
