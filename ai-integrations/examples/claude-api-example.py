#!/usr/bin/env python3
"""
Example: Using Zeal MCP Server with Claude API
This demonstrates tool extraction and execution with Claude
"""

import json
import requests
from anthropic import Anthropic
from typing import List, Dict, Any

# Configuration
ZEAL_MCP_URL = "http://localhost:3457"
ZEAL_API_KEY = "your-zeal-api-key"  # Replace with your actual key

client = Anthropic()  # Assumes ANTHROPIC_API_KEY is set in environment

def fetch_mcp_tools() -> List[Dict[str, Any]]:
    """Fetch available tools from Zeal MCP server"""
    response = requests.get(
        f"{ZEAL_MCP_URL}/tools",
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    response.raise_for_status()
    return response.json()

def execute_mcp_tool(name: str, arguments: Dict[str, Any]) -> Any:
    """Execute a Zeal MCP tool via the server"""
    response = requests.post(
        f"{ZEAL_MCP_URL}/tools/{name}/execute",
        json=arguments,
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    response.raise_for_status()
    return response.json()["result"]

def fetch_mcp_resources() -> List[Dict[str, Any]]:
    """Fetch available resources for context"""
    response = requests.get(
        f"{ZEAL_MCP_URL}/resources",
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    response.raise_for_status()
    return response.json()

def get_prompt(name: str, args: Dict[str, Any]) -> str:
    """Get a generated prompt from MCP server"""
    response = requests.get(
        f"{ZEAL_MCP_URL}/prompts/{name}",
        params=args,
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    response.raise_for_status()
    return response.json()["prompt"]

def main():
    # 1. Fetch available tools from Zeal MCP
    print("Fetching Zeal MCP tools...")
    tools = fetch_mcp_tools()
    print(f"Found {len(tools)} tools available\n")
    
    # 2. Fetch resources for context
    print("Fetching MCP resources...")
    resources = fetch_mcp_resources()
    context = "\n".join([
        f"Resource: {r['name']}\n{r['description']}\nContent: {json.dumps(r['content'], indent=2)}"
        for r in resources[:2]  # Limit to first 2 resources for brevity
    ])
    
    # 3. Create a conversation with Claude using MCP tools
    system_prompt = f"""You are a workflow automation assistant with access to the Zeal platform.
    
Available context from Zeal:
{context}

You have access to the following tools for workflow management:
{json.dumps([{"name": t["name"], "description": t["description"]} for t in tools], indent=2)}

Use these tools to help users create, optimize, and manage workflows."""

    # Example 1: Create and optimize a workflow
    print("\n" + "="*50)
    print("Example 1: Creating and optimizing a workflow")
    print("="*50)
    
    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": "Create a data processing workflow that handles CSV files, validates the data, transforms it, and stores it in a database. Make it efficient and reliable."
            }
        ],
        tools=tools,
        tool_choice={"type": "auto"}
    )
    
    print(f"\nClaude's response:")
    
    # Process the response
    for content in response.content:
        if content.type == "text":
            print(f"Text: {content.text}")
        elif content.type == "tool_use":
            print(f"\nTool call: {content.name}")
            print(f"Arguments: {json.dumps(content.input, indent=2)}")
            
            # Execute the tool
            try:
                result = execute_mcp_tool(content.name, content.input)
                print(f"Result: {json.dumps(result, indent=2)}")
                
                # Continue conversation with tool result
                follow_up = client.messages.create(
                    model="claude-3-opus-20240229",
                    max_tokens=1000,
                    system=system_prompt,
                    messages=[
                        {
                            "role": "user",
                            "content": "Create a data processing workflow that handles CSV files, validates the data, transforms it, and stores it in a database. Make it efficient and reliable."
                        },
                        {
                            "role": "assistant",
                            "content": response.content
                        },
                        {
                            "role": "user",
                            "content": f"Tool '{content.name}' returned: {json.dumps(result)}. Please continue with the workflow setup."
                        }
                    ]
                )
                
                print(f"\nFollow-up response: {follow_up.content[0].text}")
                
            except Exception as e:
                print(f"Error executing tool: {e}")

    # Example 2: Using prompts for workflow generation
    print("\n" + "="*50)
    print("Example 2: Using MCP prompts")
    print("="*50)
    
    prompt = get_prompt("workflow_from_description", {
        "description": "Monitor website for changes and send notifications",
        "complexity": "moderate"
    })
    
    print(f"Generated prompt:\n{prompt}")
    
    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )
    
    print(f"\nClaude's response: {response.content[0].text}")

    # Example 3: Debugging with AI assistance
    print("\n" + "="*50)
    print("Example 3: AI-powered debugging")
    print("="*50)
    
    debug_response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": "My workflow execution failed with ID 'exec_123'. Can you help me debug it and suggest fixes?"
            }
        ],
        tools=[t for t in tools if "debug" in t["name"]],
        tool_choice={"type": "any"}
    )
    
    for content in debug_response.content:
        if content.type == "text":
            print(f"Analysis: {content.text}")
        elif content.type == "tool_use":
            print(f"\nDebugging with tool: {content.name}")
            # In real scenario, would execute the debug tool

# Example: Compare workflows
def compare_workflows_example():
    """Example of comparing two workflows"""
    result = execute_mcp_tool("compare_workflows", {
        "workflow_a": "wf_001",
        "workflow_b": "wf_002",
        "comparison_aspects": ["structure", "performance", "reliability"]
    })
    
    print(f"Comparison results: {json.dumps(result, indent=2)}")

# Example: Generate test data
def generate_test_data_example():
    """Example of generating test data for a workflow"""
    result = execute_mcp_tool("generate_test_data", {
        "workflow_id": "wf_001",
        "test_scenarios": 10,
        "include_edge_cases": True
    })
    
    print(f"Generated test data: {json.dumps(result, indent=2)}")

if __name__ == "__main__":
    main()
    
    # Uncomment to test additional examples
    # print("\n" + "="*50)
    # print("Testing workflow comparison...")
    # compare_workflows_example()
    # 
    # print("\n" + "="*50)
    # print("Testing test data generation...")
    # generate_test_data_example()