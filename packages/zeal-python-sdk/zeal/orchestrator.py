"""Orchestrator API implementation."""

from typing import Optional, TYPE_CHECKING

from .types import (
    CreateWorkflowRequest, CreateWorkflowResponse,
    ListWorkflowsParams, ListWorkflowsResponse,
    WorkflowState,
    AddNodeRequest, AddNodeResponse,
    UpdateNodeRequest, UpdateNodeResponse,
    DeleteNodeResponse,
    ConnectNodesRequest, ConnectionResponse,
    RemoveConnectionRequest, RemoveConnectionResponse,
    CreateGroupRequest, CreateGroupResponse,
    UpdateGroupRequest, UpdateGroupResponse,
    RemoveGroupRequest, RemoveGroupResponse,
)

if TYPE_CHECKING:
    from .client import ZealClient


class OrchestratorAPI:
    """Orchestrator API for workflow management."""
    
    def __init__(self, client: "ZealClient"):
        self._client = client
    
    async def create_workflow(self, request: CreateWorkflowRequest) -> CreateWorkflowResponse:
        """Create a new workflow."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/orchestrator/workflows",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return CreateWorkflowResponse(**response.json())
    
    async def list_workflows(self, params: Optional[ListWorkflowsParams] = None) -> ListWorkflowsResponse:
        """List existing workflows."""
        query_params = None
        if params:
            query_params = params.dict(exclude_none=True)
        
        response = await self._client._make_request(
            "GET",
            "/api/zip/orchestrator/workflows",
            params=query_params
        )
        response.raise_for_status()
        return ListWorkflowsResponse(**response.json())
    
    async def get_workflow_state(
        self,
        workflow_id: str,
        graph_id: Optional[str] = None
    ) -> WorkflowState:
        """Get the current state of a workflow."""
        params = {"graphId": graph_id or "main"}
        
        response = await self._client._make_request(
            "GET",
            f"/api/zip/orchestrator/workflows/{workflow_id}/state",
            params=params
        )
        response.raise_for_status()
        return WorkflowState(**response.json())
    
    async def add_node(self, request: AddNodeRequest) -> AddNodeResponse:
        """Add a node to a workflow."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/orchestrator/nodes",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return AddNodeResponse(**response.json())
    
    async def update_node(self, node_id: str, request: UpdateNodeRequest) -> UpdateNodeResponse:
        """Update node properties."""
        response = await self._client._make_request(
            "PATCH",
            f"/api/zip/orchestrator/nodes/{node_id}",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return UpdateNodeResponse(**response.json())
    
    async def delete_node(
        self,
        node_id: str,
        workflow_id: str,
        graph_id: Optional[str] = None
    ) -> DeleteNodeResponse:
        """Delete a node."""
        params = {
            "workflowId": workflow_id,
            "graphId": graph_id or "main"
        }
        
        response = await self._client._make_request(
            "DELETE",
            f"/api/zip/orchestrator/nodes/{node_id}",
            params=params
        )
        response.raise_for_status()
        return DeleteNodeResponse(**response.json())
    
    async def connect_nodes(self, request: ConnectNodesRequest) -> ConnectionResponse:
        """Connect two nodes."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/orchestrator/connections",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return ConnectionResponse(**response.json())
    
    async def remove_connection(self, request: RemoveConnectionRequest) -> RemoveConnectionResponse:
        """Remove a connection between nodes."""
        response = await self._client._make_request(
            "DELETE",
            "/api/zip/orchestrator/connections",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return RemoveConnectionResponse(**response.json())
    
    async def create_group(self, request: CreateGroupRequest) -> CreateGroupResponse:
        """Create a node group."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/orchestrator/groups",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return CreateGroupResponse(**response.json())
    
    async def update_group(self, request: UpdateGroupRequest) -> UpdateGroupResponse:
        """Update group properties."""
        response = await self._client._make_request(
            "PATCH",
            "/api/zip/orchestrator/groups",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return UpdateGroupResponse(**response.json())
    
    async def remove_group(self, request: RemoveGroupRequest) -> RemoveGroupResponse:
        """Remove a group."""
        response = await self._client._make_request(
            "DELETE",
            "/api/zip/orchestrator/groups",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return RemoveGroupResponse(**response.json())