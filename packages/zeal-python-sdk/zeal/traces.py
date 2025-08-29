"""Traces API implementation."""

import json
import time
from typing import List, Optional, Any, TYPE_CHECKING

from .types import (
    CreateTraceSessionRequest, CreateTraceSessionResponse,
    TraceEvent, SubmitEventsResponse,
    CompleteSessionRequest, CompleteSessionResponse,
    TraceData,
)

if TYPE_CHECKING:
    from .client import ZealClient


class TracesAPI:
    """Traces API for execution tracing."""
    
    def __init__(self, client: "ZealClient"):
        self._client = client
        self._session_id: Optional[str] = None
    
    @property
    def current_session_id(self) -> Optional[str]:
        """Get the current session ID."""
        return self._session_id
    
    async def create_session(self, request: CreateTraceSessionRequest) -> CreateTraceSessionResponse:
        """Create a new trace session."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/traces/sessions",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        
        result = CreateTraceSessionResponse(**response.json())
        self._session_id = result.session_id
        return result
    
    async def submit_events(self, session_id: str, events: List[TraceEvent]) -> SubmitEventsResponse:
        """Submit trace events."""
        request_body = {
            "events": [event.dict(by_alias=True, exclude_none=True) for event in events]
        }
        
        response = await self._client._make_request(
            "POST",
            f"/api/zip/traces/{session_id}/events",
            json_data=request_body
        )
        response.raise_for_status()
        return SubmitEventsResponse(**response.json())
    
    async def submit_event(self, session_id: str, event: TraceEvent) -> SubmitEventsResponse:
        """Submit a single trace event."""
        return await self.submit_events(session_id, [event])
    
    async def complete_session(
        self,
        session_id: str,
        request: CompleteSessionRequest
    ) -> CompleteSessionResponse:
        """Complete a trace session."""
        response = await self._client._make_request(
            "POST",
            f"/api/zip/traces/{session_id}/complete",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        
        result = CompleteSessionResponse(**response.json())
        if self._session_id == session_id:
            self._session_id = None
        
        return result
    
    async def trace_node_execution(
        self,
        session_id: str,
        node_id: str,
        event_type: str,
        data: Any,
        duration_ms: Optional[int] = None
    ) -> None:
        """Helper method to trace node execution.
        
        Args:
            session_id: Trace session ID
            node_id: Node ID being traced
            event_type: Type of trace event
            data: Event data
            duration_ms: Execution duration in milliseconds
        """
        data_json = json.dumps(data)
        trace_data = TraceData(
            size=len(data_json),
            data_type="application/json",
            preview=data,
            full_data=data
        )
        
        event = TraceEvent(
            timestamp=int(time.time() * 1000),
            node_id=node_id,
            event_type=event_type,
            data=trace_data,
            duration=duration_ms
        )
        
        await self.submit_event(session_id, event)