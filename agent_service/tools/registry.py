from typing import Dict, Any, Callable
from agent_service.actions.models import AgentAction

class ToolRegistry:
    def __init__(self):
        self.tools: Dict[str, Callable] = {}
        self.register_default_tools()

    def register(self, name: str, func: Callable):
        self.tools[name] = func

    def register_default_tools(self):
        self.register("navigate", self.navigate_to_page)
        self.register("start_recording", self.start_recording)
        self.register("stop_recording", self.stop_recording)
        self.register("open_modal", self.open_modal)
        self.register("display_summary", self.display_summary)
        self.register("open_quiz", self.open_quiz)

    def navigate_to_page(self, target: str) -> AgentAction:
        """Returns an action to redirect the user to a page (e.g. 'dashboard', 'tutor', 'revision')."""
        # Normalize target to frontend page names
        page = target.strip("/").lower()
        if "tutor" in page:
            page = "tutor"
        elif "revision" in page or "quiz" in page or "flashcard" in page:
            page = "revision"
        elif "lecture" in page or "recording" in page:
            page = "lecture-studio"
        elif "analytics" in page or "stats" in page:
            page = "analytics"
        elif "graph" in page or "network" in page:
            page = "knowledge-graph"
        else:
            page = "dashboard"
            
        return AgentAction(action="navigate", target=page)

    def start_recording(self, subject: str = "DBMS") -> AgentAction:
        """Returns an action to initialize mic stream and start recording lecture."""
        return AgentAction(action="start_recording", target="lecture-studio", payload={"subject": subject})

    def stop_recording(self) -> AgentAction:
        """Returns an action to stop active recording and finalize audio processing."""
        return AgentAction(action="stop_recording", target="lecture-studio")

    def open_modal(self, modal_name: str) -> AgentAction:
        """Returns an action to open a modal interface (e.g. 'create_goal', 'view_revisions')."""
        return AgentAction(action="open_modal", target=modal_name)

    def display_summary(self, title: str, concepts: list) -> AgentAction:
        """Returns an action to display a lecture summary card."""
        return AgentAction(action="display_summary", target="lecture-studio", payload={"title": title, "concepts": concepts})

    def open_quiz(self, topic: str = "DBMS") -> AgentAction:
        """Returns an action to navigate to revision center and open a quiz session."""
        return AgentAction(action="open_quiz", target="revision", payload={"topic": topic})

    def execute_tool(self, tool_name: str, **kwargs) -> AgentAction:
        if tool_name in self.tools:
            try:
                return self.tools[tool_name](**kwargs)
            except Exception as e:
                print(f"Error executing tool {tool_name}: {e}")
        return AgentAction(action="unknown", payload={"error": f"Tool {tool_name} not found"})

tool_registry = ToolRegistry()
