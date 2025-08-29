# AI Integration Services for Zeal on AWS
# This module deploys OpenAI Functions and MCP servers

# Security Group for AI Services
resource "aws_security_group" "ai_services" {
  name        = "${var.cluster_name}-ai-services"
  description = "Security group for Zeal AI services"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "OpenAI Functions"
    from_port   = 3456
    to_port     = 3456
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "MCP Server"
    from_port   = 3457
    to_port     = 3457
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.cluster_name}-ai-services"
  }
}

# ECS Task Definition for OpenAI Functions
resource "aws_ecs_task_definition" "openai_functions" {
  count = var.enable_ai_integrations ? 1 : 0
  
  family                   = "${var.cluster_name}-openai-functions"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ai_service_cpu
  memory                   = var.ai_service_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "openai-functions"
      image = "${var.ecr_repository_url}/openai-functions:${var.ai_service_version}"
      
      portMappings = [
        {
          containerPort = 3456
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "PORT"
          value = "3456"
        },
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "ZEAL_API_URL"
          value = "http://zeal-app.${var.cluster_name}.local:3000"
        },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
        }
      ]
      
      secrets = [
        {
          name      = "ZEAL_API_KEY"
          valueFrom = aws_secretsmanager_secret.zeal_api_key.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ai_services[0].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "openai-functions"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3456/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

# ECS Task Definition for MCP Server
resource "aws_ecs_task_definition" "mcp_server" {
  count = var.enable_ai_integrations ? 1 : 0
  
  family                   = "${var.cluster_name}-mcp-server"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ai_service_cpu
  memory                   = var.ai_service_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "mcp-server"
      image = "${var.ecr_repository_url}/mcp-server:${var.ai_service_version}"
      
      portMappings = [
        {
          containerPort = 3457
          protocol      = "tcp"
        }
      ]
      
      environment = [
        {
          name  = "PORT"
          value = "3457"
        },
        {
          name  = "MCP_TRANSPORT"
          value = "http"
        },
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "ZEAL_API_URL"
          value = "http://zeal-app.${var.cluster_name}.local:3000"
        },
        {
          name  = "ENABLE_AI_OPTIMIZATION"
          value = "true"
        },
        {
          name  = "ENABLE_AUTO_DESIGN"
          value = "true"
        }
      ]
      
      secrets = [
        {
          name      = "ZEAL_API_KEY"
          valueFrom = aws_secretsmanager_secret.zeal_api_key.arn
        },
        {
          name      = "OPENROUTER_API_KEY"
          valueFrom = aws_secretsmanager_secret.openrouter_api_key.arn
        }
      ]
      
      mountPoints = [
        {
          sourceVolume  = "graphrag-data"
          containerPath = "/app/data"
          readOnly      = true
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ai_services[0].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "mcp-server"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3457/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
  
  volume {
    name = "graphrag-data"
    
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.graphrag[0].id
      root_directory = "/"
    }
  }
}

# EFS for GraphRAG data
resource "aws_efs_file_system" "graphrag" {
  count = var.enable_ai_integrations ? 1 : 0
  
  creation_token = "${var.cluster_name}-graphrag"
  encrypted      = true
  
  tags = {
    Name = "${var.cluster_name}-graphrag"
  }
}

# EFS Mount Targets
resource "aws_efs_mount_target" "graphrag" {
  count = var.enable_ai_integrations ? length(module.vpc.private_subnets) : 0
  
  file_system_id  = aws_efs_file_system.graphrag[0].id
  subnet_id       = module.vpc.private_subnets[count.index]
  security_groups = [aws_security_group.efs.id]
}

# ECS Services for AI
resource "aws_ecs_service" "openai_functions" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name            = "${var.cluster_name}-openai-functions"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.openai_functions[0].arn
  desired_count   = var.ai_service_count
  launch_type     = "FARGATE"
  
  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ai_services.id]
    assign_public_ip = false
  }
  
  service_registries {
    registry_arn = aws_service_discovery_service.openai_functions[0].arn
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.openai_functions[0].arn
    container_name   = "openai-functions"
    container_port   = 3456
  }
  
  depends_on = [
    aws_lb_listener.ai_services
  ]
}

resource "aws_ecs_service" "mcp_server" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name            = "${var.cluster_name}-mcp-server"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.mcp_server[0].arn
  desired_count   = var.ai_service_count
  launch_type     = "FARGATE"
  
  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ai_services.id]
    assign_public_ip = false
  }
  
  service_registries {
    registry_arn = aws_service_discovery_service.mcp_server[0].arn
  }
  
  load_balancer {
    target_group_arn = aws_lb_target_group.mcp_server[0].arn
    container_name   = "mcp-server"
    container_port   = 3457
  }
  
  depends_on = [
    aws_lb_listener.ai_services
  ]
}

# Application Load Balancer for AI Services
resource "aws_lb_target_group" "openai_functions" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name        = "${var.cluster_name}-openai-fn"
  port        = 3456
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }
}

resource "aws_lb_target_group" "mcp_server" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name        = "${var.cluster_name}-mcp"
  port        = 3457
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }
}

# ALB Listener Rules for AI Services
resource "aws_lb_listener_rule" "openai_functions" {
  count = var.enable_ai_integrations ? 1 : 0
  
  listener_arn = aws_lb_listener.main.arn
  priority     = 200
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.openai_functions[0].arn
  }
  
  condition {
    path_pattern {
      values = ["/openai/*"]
    }
  }
}

resource "aws_lb_listener_rule" "mcp_server" {
  count = var.enable_ai_integrations ? 1 : 0
  
  listener_arn = aws_lb_listener.main.arn
  priority     = 201
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.mcp_server[0].arn
  }
  
  condition {
    path_pattern {
      values = ["/mcp/*"]
    }
  }
}

# Service Discovery for AI Services
resource "aws_service_discovery_service" "openai_functions" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name = "openai-functions"
  
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  
  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_service_discovery_service" "mcp_server" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name = "mcp-server"
  
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }
  }
  
  health_check_custom_config {
    failure_threshold = 1
  }
}

# CloudWatch Log Group for AI Services
resource "aws_cloudwatch_log_group" "ai_services" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name              = "/ecs/${var.cluster_name}/ai-services"
  retention_in_days = var.log_retention_days
}

# Auto Scaling for AI Services
resource "aws_appautoscaling_target" "openai_functions" {
  count = var.enable_ai_integrations ? 1 : 0
  
  max_capacity       = var.ai_service_max_count
  min_capacity       = var.ai_service_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.openai_functions[0].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "openai_functions_cpu" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name               = "${var.cluster_name}-openai-functions-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.openai_functions[0].resource_id
  scalable_dimension = aws_appautoscaling_target.openai_functions[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.openai_functions[0].service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# Lambda for GraphRAG Builder (runs periodically)
resource "aws_lambda_function" "graphrag_builder" {
  count = var.enable_ai_integrations ? 1 : 0
  
  filename         = "${path.module}/lambda/graphrag-builder.zip"
  function_name    = "${var.cluster_name}-graphrag-builder"
  role            = aws_iam_role.lambda_graphrag.arn
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory_size     = 1024
  
  environment {
    variables = {
      DATABASE_URL       = "postgresql://${var.rds_username}:${random_password.rds.result}@${aws_db_instance.postgres.endpoint}/${var.rds_database_name}"
      OPENROUTER_API_KEY = data.aws_secretsmanager_secret_version.openrouter_api_key.secret_string
      EFS_MOUNT_PATH     = "/mnt/efs"
    }
  }
  
  file_system_config {
    arn              = aws_efs_access_point.graphrag_lambda[0].arn
    local_mount_path = "/mnt/efs"
  }
  
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
}

# EventBridge Rule to trigger GraphRAG builder daily
resource "aws_cloudwatch_event_rule" "graphrag_builder" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                = "${var.cluster_name}-graphrag-builder"
  description         = "Trigger GraphRAG builder daily"
  schedule_expression = "cron(0 2 * * ? *)" # Run at 2 AM UTC daily
}

resource "aws_cloudwatch_event_target" "graphrag_builder" {
  count = var.enable_ai_integrations ? 1 : 0
  
  rule      = aws_cloudwatch_event_rule.graphrag_builder[0].name
  target_id = "graphrag-builder-lambda"
  arn       = aws_lambda_function.graphrag_builder[0].arn
}

# Secrets Manager for AI API Keys
resource "aws_secretsmanager_secret" "openrouter_api_key" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name = "${var.cluster_name}-openrouter-api-key"
}