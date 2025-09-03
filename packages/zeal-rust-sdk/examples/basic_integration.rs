//! Basic integration example for the Zeal Rust SDK
//!
//! This example demonstrates how to:
//! - Initialize the Zeal client
//! - Create a basic webhook subscription
//! - Handle incoming events
//! - Send runtime events back to Zeal

use zeal_sdk::{errors::Result, events, types::*, ClientConfig, ZealClient};

use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    println!("🚀 Starting Zeal Rust SDK Basic Integration Example");

    // Create client with default configuration
    let client = ZealClient::new(ClientConfig {
        base_url: "http://localhost:3000".to_string(),
        ..Default::default()
    })?;

    // Test connection with health check
    println!("📡 Checking connection to Zeal server...");
    let health = client.health().await?;
    println!("✅ Server health: {:?}", health.status);

    // Register some example node templates
    println!("📝 Registering node templates...");
    register_example_templates(&client).await?;

    // Create a workflow using the orchestrator
    println!("🔧 Creating example workflow...");
    let workflow = create_example_workflow(&client).await?;

    // Set up event subscription
    println!("🎧 Setting up event subscription...");
    setup_event_subscription(&client, &workflow.workflow_id).await?;

    // Simulate some workflow execution
    println!("▶️ Simulating workflow execution...");
    simulate_workflow_execution(&client, &workflow.workflow_id).await?;

    println!("✨ Example completed successfully!");
    Ok(())
}

/// Register example node templates
async fn register_example_templates(_client: &ZealClient) -> Result<()> {
    // Note: In a real implementation, these would use the actual TemplatesAPI
    // For this basic example, we'll just show the structure

    let templates = vec![
        NodeTemplate {
            id: "data-processor".to_string(),
            type_name: "processor".to_string(),
            title: "Data Processor".to_string(),
            subtitle: Some("Processes incoming data".to_string()),
            category: "Processing".to_string(),
            subcategory: Some("Data".to_string()),
            description: "Efficiently processes data with configurable options".to_string(),
            icon: "processor".to_string(),
            variant: None,
            shape: Some(NodeShape::Rectangle),
            size: Some(NodeSize::Medium),
            ports: vec![
                Port {
                    id: "input".to_string(),
                    label: "Data Input".to_string(),
                    port_type: PortType::Input,
                    position: PortPosition::Left,
                    data_type: Some("application/json".to_string()),
                    required: Some(true),
                    multiple: Some(false),
                },
                Port {
                    id: "output".to_string(),
                    label: "Processed Data".to_string(),
                    port_type: PortType::Output,
                    position: PortPosition::Right,
                    data_type: Some("application/json".to_string()),
                    required: None,
                    multiple: Some(false),
                },
            ],
            properties: Some({
                let mut props = std::collections::HashMap::new();
                props.insert(
                    "batch_size".to_string(),
                    PropertyDefinition {
                        property_type: PropertyType::Number,
                        label: Some("Batch Size".to_string()),
                        description: Some("Number of items to process in each batch".to_string()),
                        default_value: Some(serde_json::json!(100)),
                        options: None,
                        validation: Some(PropertyValidation {
                            required: Some(false),
                            min: Some(1.0),
                            max: Some(10000.0),
                            pattern: None,
                        }),
                    },
                );
                props
            }),
            property_rules: None,
            runtime: Some(RuntimeRequirements {
                executor: "rust-runtime".to_string(),
                version: Some("1.0.0".to_string()),
                required_env_vars: Some(vec!["PROCESSOR_CONFIG".to_string()]),
                capabilities: Some(vec!["data-processing".to_string()]),
            }),
        },
        NodeTemplate {
            id: "data-validator".to_string(),
            type_name: "validator".to_string(),
            title: "Data Validator".to_string(),
            subtitle: None,
            category: "Processing".to_string(),
            subcategory: Some("Validation".to_string()),
            description: "Validates data against configurable schemas".to_string(),
            icon: "validator".to_string(),
            variant: None,
            shape: Some(NodeShape::Diamond),
            size: Some(NodeSize::Small),
            ports: vec![
                Port {
                    id: "input".to_string(),
                    label: "Data".to_string(),
                    port_type: PortType::Input,
                    position: PortPosition::Left,
                    data_type: Some("application/json".to_string()),
                    required: Some(true),
                    multiple: Some(false),
                },
                Port {
                    id: "valid".to_string(),
                    label: "Valid Data".to_string(),
                    port_type: PortType::Output,
                    position: PortPosition::Right,
                    data_type: Some("application/json".to_string()),
                    required: None,
                    multiple: Some(false),
                },
                Port {
                    id: "invalid".to_string(),
                    label: "Invalid Data".to_string(),
                    port_type: PortType::Output,
                    position: PortPosition::Bottom,
                    data_type: Some("application/json".to_string()),
                    required: None,
                    multiple: Some(false),
                },
            ],
            properties: Some({
                let mut props = std::collections::HashMap::new();
                props.insert(
                    "schema".to_string(),
                    PropertyDefinition {
                        property_type: PropertyType::CodeEditor,
                        label: Some("JSON Schema".to_string()),
                        description: Some("JSON schema for validation".to_string()),
                        default_value: Some(serde_json::json!({})),
                        options: None,
                        validation: Some(PropertyValidation {
                            required: Some(true),
                            min: None,
                            max: None,
                            pattern: None,
                        }),
                    },
                );
                props
            }),
            property_rules: None,
            runtime: Some(RuntimeRequirements {
                executor: "rust-runtime".to_string(),
                version: Some("1.0.0".to_string()),
                required_env_vars: None,
                capabilities: Some(vec!["data-validation".to_string()]),
            }),
        },
    ];

    // In a real implementation, this would be:
    // client.templates().register("rust-example", templates, None).await?;

    println!("   Registered {} node templates", templates.len());
    Ok(())
}

/// Create an example workflow using the orchestrator API
async fn create_example_workflow(client: &ZealClient) -> Result<CreateWorkflowResponse> {
    // In a real implementation, this would use the actual OrchestratorAPI
    // For this basic example, we'll return mock data

    let workflow_response = CreateWorkflowResponse {
        workflow_id: format!("workflow-{}", uuid::Uuid::new_v4()),
        graph_id: "main".to_string(),
        embed_url: format!("{}/embed/workflow", client.base_url()),
    };

    println!("   Created workflow: {}", workflow_response.workflow_id);
    Ok(workflow_response)
}

/// Set up event subscription to listen for workflow events
async fn setup_event_subscription(_client: &ZealClient, workflow_id: &str) -> Result<()> {
    // In a real implementation, this would use the WebhookSubscription
    // For this basic example, we'll simulate event handling

    println!("   Subscribed to events for workflow: {}", workflow_id);

    // Simulate handling some common events
    handle_workflow_events(workflow_id).await?;

    Ok(())
}

/// Simulate handling various workflow events
async fn handle_workflow_events(workflow_id: &str) -> Result<()> {
    println!("   📥 Handling workflow events:");

    // Simulate receiving a node execution request
    let node_executing_event = events::create_node_executing_event(
        workflow_id,
        "data-processor-1",
        vec!["connection-1".to_string()],
        Some("main".to_string()),
    );

    println!(
        "     🔄 Node executing: {} in workflow {}",
        node_executing_event.node_id, node_executing_event.base.workflow_id
    );

    // Simulate processing time
    sleep(Duration::from_millis(100)).await;

    // Simulate node completion
    let node_completed_event = events::create_node_completed_event(
        workflow_id,
        "data-processor-1",
        vec!["connection-2".to_string()],
        Some(events::NodeCompletedOptions {
            duration: Some(95),
            output_size: Some(2048),
            metadata: Some({
                let mut meta = std::collections::HashMap::new();
                meta.insert("processed_items".to_string(), serde_json::json!(42));
                meta
            }),
            ..Default::default()
        }),
    );

    println!(
        "     ✅ Node completed: {} ({}ms, {} bytes)",
        node_completed_event.node_id,
        node_completed_event.duration.unwrap_or(0),
        node_completed_event.output_size.unwrap_or(0)
    );

    Ok(())
}

/// Simulate workflow execution by sending events
async fn simulate_workflow_execution(_client: &ZealClient, workflow_id: &str) -> Result<()> {
    println!(
        "   Starting execution simulation for workflow: {}",
        workflow_id
    );

    // Create execution started event
    let execution_started = events::create_execution_started_event(
        workflow_id,
        &format!("session-{}", uuid::Uuid::new_v4()),
        "Rust SDK Example Workflow",
        Some(events::ExecutionStartedOptions {
            trigger: Some(events::ExecutionTrigger {
                trigger_type: "manual".to_string(),
                source: Some("rust-sdk-example".to_string()),
            }),
            ..Default::default()
        }),
    );

    println!(
        "     🚀 Execution started: {}",
        execution_started.session_id
    );

    // Simulate some processing time
    sleep(Duration::from_millis(200)).await;

    // Simulate multiple nodes executing
    for i in 1..=3 {
        let node_id = format!("node-{}", i);

        // Node executing
        let _executing_event = events::create_node_executing_event(
            workflow_id,
            &node_id,
            if i == 1 {
                vec![]
            } else {
                vec![format!("conn-{}", i - 1)]
            },
            Some("main".to_string()),
        );

        println!("     🔄 Node {} executing...", node_id);

        // Simulate processing
        sleep(Duration::from_millis(50)).await;

        // Node completed
        let completed_event = events::create_node_completed_event(
            workflow_id,
            &node_id,
            vec![format!("conn-{}", i)],
            Some(events::NodeCompletedOptions {
                duration: Some(45 + i * 10),
                output_size: Some(1024 * i),
                ..Default::default()
            }),
        );

        println!(
            "     ✅ Node {} completed ({}ms)",
            node_id,
            completed_event.duration.unwrap_or(0)
        );
    }

    // Create execution completed event
    let execution_completed = events::create_execution_completed_event(
        workflow_id,
        &execution_started.session_id,
        285, // Total duration
        3,   // Nodes executed
        Some(events::ExecutionCompletedOptions {
            summary: Some(events::ExecutionSummary {
                success_count: 3,
                error_count: 0,
                warning_count: 0,
            }),
            ..Default::default()
        }),
    );

    println!(
        "     🎉 Execution completed: {} ({}ms, {} nodes)",
        execution_completed.session_id,
        execution_completed.duration,
        execution_completed.nodes_executed
    );

    // In a real implementation, these events would be sent via:
    // client.events().send_runtime_event(event).await?;

    Ok(())
}
