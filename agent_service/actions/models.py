from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class AgentAction(BaseModel):
    action: str = Field(..., description="Action name, e.g. 'navigate', 'open_modal', 'start_recording', 'stop_recording', 'display_summary', 'open_quiz'")
    target: Optional[str] = Field(None, description="Action target page path or element, e.g. '/tutor', '/lecture-studio', '/revision'")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Additional context payload for the action")

class WebSocketResponse(BaseModel):
    event: str = Field(..., description="Event classification, e.g., 'result', 'transcript', 'notification'")
    transcript: Optional[str] = None
    intent: Optional[str] = None
    response: Optional[str] = None
    audioUrl: Optional[str] = None
    agentExecuted: Optional[str] = None
    action: Optional[AgentAction] = None
