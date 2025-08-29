"""Test Zeal client functionality."""

import pytest
from datetime import timedelta

from zeal import ZealClient, ClientConfig
from zeal.types import CreateWorkflowRequest, Position, AddNodeRequest, NodePort
from zeal.events import (
    create_node_added_event, create_group_created_event,
    is_execution_event, is_workflow_event, is_crdt_event,
    is_control_event, is_node_event, is_group_event
)


def test_client_config():
    """Test client configuration."""
    config = ClientConfig(
        base_url="http://localhost:3000",
        default_timeout=timedelta(seconds=60)
    )
    
    assert config.base_url == "http://localhost:3000"
    assert config.default_timeout == timedelta(seconds=60)
    assert config.verify_tls is True
    assert config.user_agent == "zeal-python-sdk/1.0.0"


def test_client_creation():
    """Test client creation."""
    config = ClientConfig(base_url="http://localhost:3000")
    client = ZealClient(config)
    
    assert client.base_url == "http://localhost:3000"
    assert client.orchestrator is not None
    assert client.templates is not None
    assert client.traces is not None
    assert client.webhooks is not None


def test_client_creation_no_base_url():
    """Test client creation with empty base URL should fail."""
    config = ClientConfig(base_url="")
    
    with pytest.raises(ValueError, match="Base URL cannot be empty"):
        ZealClient(config)


def test_type_creation():
    """Test creating request types."""
    # Test workflow request
    workflow_req = CreateWorkflowRequest(
        name="Test Workflow",
        description="A test workflow"
    )
    assert workflow_req.name == "Test Workflow"
    assert workflow_req.description == "A test workflow"
    
    # Test node request
    node_req = AddNodeRequest(
        workflow_id="wf-123",
        template_id="processor",
        position=Position(x=100, y=200),
        properties={"param1": "value1"}
    )
    assert node_req.workflow_id == "wf-123"
    assert node_req.template_id == "processor"
    assert node_req.position.x == 100
    assert node_req.position.y == 200


def test_event_creation():
    """Test creating events."""
    # Test node added event
    event = create_node_added_event(
        workflow_id="wf-123",
        node_id="node-456",
        data={"type": "processor", "name": "Test Node"}
    )
    
    assert event.type == "node.added"
    assert event.workflow_id == "wf-123"
    assert event.node_id == "node-456"
    assert event.data["type"] == "processor"
    assert event.id.startswith("evt_")
    
    # Test group created event
    group_event = create_group_created_event(
        workflow_id="wf-123",
        data={"title": "Processing Group", "color": "#blue"}
    )
    
    assert group_event.type == "group.created"
    assert group_event.workflow_id == "wf-123"
    assert group_event.data["title"] == "Processing Group"


def test_event_type_guards():
    """Test event type guard functions."""
    test_cases = [
        ("node.executing", True, False, False, False, True, False),
        ("execution.started", True, False, False, False, False, False),
        ("workflow.created", False, True, False, False, False, False),
        ("node.added", False, False, True, False, True, False),
        ("group.created", False, False, True, False, False, True),
        ("connection.added", False, False, True, False, False, False),
        ("subscribe", False, False, False, True, False, False),
        ("ping", False, False, False, True, False, False),
    ]
    
    for event_type, is_exec, is_wf, is_crdt, is_ctrl, is_node, is_grp in test_cases:
        assert is_execution_event(event_type) == is_exec, f"is_execution_event({event_type})"
        assert is_workflow_event(event_type) == is_wf, f"is_workflow_event({event_type})"
        assert is_crdt_event(event_type) == is_crdt, f"is_crdt_event({event_type})"
        assert is_control_event(event_type) == is_ctrl, f"is_control_event({event_type})"
        assert is_node_event(event_type) == is_node, f"is_node_event({event_type})"
        assert is_group_event(event_type) == is_grp, f"is_group_event({event_type})"


def test_position_serialization():
    """Test Position serialization."""
    pos = Position(x=100.5, y=200.7)
    data = pos.dict()
    
    assert data["x"] == 100.5
    assert data["y"] == 200.7
    
    # Test deserialization
    pos2 = Position(**data)
    assert pos2.x == 100.5
    assert pos2.y == 200.7


def test_node_port_serialization():
    """Test NodePort serialization with aliases."""
    port = NodePort(node_id="node1", port_id="output")
    data = port.dict(by_alias=True)
    
    assert data["nodeId"] == "node1"
    assert data["portId"] == "output"
    
    # Test deserialization from API format
    port2 = NodePort(**{"nodeId": "node2", "portId": "input"})
    assert port2.node_id == "node2"
    assert port2.port_id == "input"