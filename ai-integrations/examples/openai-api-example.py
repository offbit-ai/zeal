#!/usr/bin/env python3
"""
Example: Using Zeal OpenAI Functions with the OpenAI API
This demonstrates tool extraction and execution with GPT models
"""

import json
import requests
from openai import OpenAI
from typing import List, Dict, Any

# Configuration
ZEAL_FUNCTIONS_URL = "http://localhost:3456"
ZEAL_API_KEY = "your-zeal-api-key"  # Replace with your actual key

client = OpenAI()  # Assumes OPENAI_API_KEY is set in environment

def fetch_zeal_functions() -> List[Dict[str, Any]]:
    """Fetch available functions from Zeal OpenAI Functions server"""
    response = requests.get(
        f"{ZEAL_FUNCTIONS_URL}/tools",
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    response.raise_for_status()
    return response.json()

def execute_zeal_function(name: str, arguments: Dict[str, Any]) -> Any:
    """Execute a Zeal function via the server"""
    response = requests.post(
        f"{ZEAL_FUNCTIONS_URL}/functions/execute",
        json={"name": name, "arguments": arguments},
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    response.raise_for_status()
    return response.json()["result"]

def main():
    # 1. Fetch available tools from Zeal
    print("Fetching Zeal functions...")
    tools = fetch_zeal_functions()
    print(f"Found {len(tools)} functions available\n")
    
    # 2. Create a conversation with GPT using Zeal tools
    messages = [
        {
            "role": "system",
            "content": "You are a workflow automation assistant. Use the available tools to help users create and manage workflows in Zeal."
        },
        {
            "role": "user",
            "content": "Create a workflow that fetches data from an API every hour, transforms it, and saves it to a database. Then add the necessary nodes and connections."
        }
    ]
    
    print("Sending request to GPT-4...")
    response = client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=messages,
        tools=tools,
        tool_choice="auto"
    )
    
    assistant_message = response.choices[0].message
    
    # 3. Process tool calls if any
    if assistant_message.tool_calls:
        print(f"\nGPT wants to call {len(assistant_message.tool_calls)} functions:")
        
        tool_results = []
        for tool_call in assistant_message.tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            
            print(f"\nExecuting: {function_name}")
            print(f"Arguments: {json.dumps(function_args, indent=2)}")
            
            try:
                # Execute the function via Zeal server
                result = execute_zeal_function(function_name, function_args)
                print(f"Result: {json.dumps(result, indent=2)}")
                
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps(result)
                })
            except Exception as e:
                print(f"Error: {e}")
                tool_results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps({"error": str(e)})
                })
        
        # 4. Send results back to GPT for final response
        messages.append(assistant_message)
        messages.extend(tool_results)
        
        print("\nGetting final response from GPT...")
        final_response = client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=messages
        )
        
        print("\nFinal Response:")
        print(final_response.choices[0].message.content)
    else:
        print("\nGPT Response (no tool calls):")
        print(assistant_message.content)

# Example: Streaming execution events
def stream_execution_events(execution_id: str):
    """Stream real-time execution events"""
    response = requests.get(
        f"{ZEAL_FUNCTIONS_URL}/functions/stream/{execution_id}",
        headers={"X-API-Key": ZEAL_API_KEY},
        stream=True
    )
    
    for line in response.iter_lines():
        if line:
            if line.startswith(b'data: '):
                event_data = json.loads(line[6:])
                print(f"Event: {event_data}")

# Example: Batch execution
def batch_execute_example():
    """Execute multiple functions in batch"""
    batch_calls = [
        {
            "name": "create_workflow",
            "arguments": {
                "name": "Data Pipeline 1",
                "description": "First pipeline"
            }
        },
        {
            "name": "create_workflow",
            "arguments": {
                "name": "Data Pipeline 2",
                "description": "Second pipeline"
            }
        }
    ]
    
    response = requests.post(
        f"{ZEAL_FUNCTIONS_URL}/functions/batch",
        json={"calls": batch_calls},
        headers={"X-API-Key": ZEAL_API_KEY}
    )
    
    results = response.json()
    print(f"Batch execution results: {json.dumps(results, indent=2)}")

if __name__ == "__main__":
    main()
    
    # Uncomment to test batch execution
    # print("\n" + "="*50)
    # print("Testing batch execution...")
    # batch_execute_example()