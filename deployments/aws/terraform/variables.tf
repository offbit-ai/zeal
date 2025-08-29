variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "zeal-production"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "domain" {
  description = "Domain name for the application"
  type        = string
}

# AI Integration Variables
variable "enable_ai_integrations" {
  description = "Enable AI integrations (OpenAI Functions and MCP Server)"
  type        = bool
  default     = false
}

variable "ai_service_cpu" {
  description = "CPU units for AI service tasks"
  type        = string
  default     = "512"
}

variable "ai_service_memory" {
  description = "Memory for AI service tasks"
  type        = string
  default     = "1024"
}

variable "ai_service_count" {
  description = "Number of AI service instances"
  type        = number
  default     = 2
}

variable "ai_service_max_count" {
  description = "Maximum number of AI service instances for auto-scaling"
  type        = number
  default     = 10
}

variable "ai_service_version" {
  description = "Version tag for AI service images"
  type        = string
  default     = "latest"
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for GraphRAG (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "openrouter_model" {
  description = "OpenRouter model for GraphRAG"
  type        = string
  default     = "anthropic/claude-3-haiku-20240307"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "rds_instance_type" {
  description = "Instance type for RDS databases"
  type        = string
  default     = "db.r5.large"
}

variable "elasticache_node_type" {
  description = "Node type for ElastiCache Redis"
  type        = string
  default     = "cache.r6g.large"
}

variable "create_route53_zone" {
  description = "Whether to create a new Route53 hosted zone"
  type        = bool
  default     = false
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS nodes"
  type        = list(string)
  default     = ["t3.xlarge", "t3a.xlarge"]
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS nodes"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS nodes"
  type        = number
  default     = 10
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS nodes"
  type        = number
  default     = 3
}

# TimescaleDB Retention Policy Variables
variable "timescale_retention_flow_traces" {
  description = "Retention period for flow traces in TimescaleDB"
  type        = string
  default     = "30 days"
}

variable "timescale_retention_trace_events" {
  description = "Retention period for trace events in TimescaleDB"
  type        = string
  default     = "7 days"
}

variable "timescale_retention_sessions" {
  description = "Retention period for flow trace sessions in TimescaleDB"
  type        = string
  default     = "90 days"
}