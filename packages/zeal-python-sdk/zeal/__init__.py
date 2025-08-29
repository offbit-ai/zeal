"""
Zeal Python SDK

Python SDK for the Zeal Integration Protocol (ZIP) - A comprehensive toolkit 
for workflow automation and real-time collaboration.
"""

__version__ = "1.0.0"

from .client import ZealClient
from .config import ClientConfig
from .types import *
from .events import *
from . import orchestrator, templates, traces, webhooks

__all__ = [
    "ZealClient",
    "ClientConfig",
    # Re-export all types and events
    "CreateWorkflowRequest",
    "CreateWorkflowResponse", 
    "AddNodeRequest",
    "AddNodeResponse",
    "NodeExecutingEvent",
    "NodeAddedEvent",
    "GroupCreatedEvent",
    "WorkflowCreatedEvent",
    # Add other exports as needed
]