terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
  
  backend "s3" {
    # Configure your backend
    # bucket = "your-terraform-state-bucket"
    # key    = "zeal/terraform.tfstate"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment = var.environment
      Project     = "Zeal"
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC Module
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"
  
  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr
  
  azs             = data.aws_availability_zones.available.names
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true
  
  enable_flow_log                      = true
  create_flow_log_cloudwatch_iam_role  = true
  create_flow_log_cloudwatch_log_group = true
  
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
  
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# Security Groups
resource "aws_security_group" "rds" {
  name_prefix = "${var.cluster_name}-rds-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "elasticache" {
  name_prefix = "${var.cluster_name}-elasticache-"
  vpc_id      = module.vpc.vpc_id
  
  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS PostgreSQL
resource "aws_db_subnet_group" "main" {
  name       = "${var.cluster_name}-db-subnet"
  subnet_ids = module.vpc.private_subnets
  
  tags = {
    Name = "${var.cluster_name} DB subnet group"
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.cluster_name}-postgres"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_type
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = "zeal_db"
  username = "zeal_user"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  multi_az               = var.environment == "production"
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.cluster_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  tags = {
    Name = "${var.cluster_name}-postgres"
  }
}

# RDS for TimescaleDB
resource "aws_db_instance" "timescaledb" {
  identifier     = "${var.cluster_name}-timescaledb"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_type
  
  allocated_storage     = 200
  max_allocated_storage = 2000
  storage_type          = "gp3"
  storage_encrypted     = true
  iops                  = 12000
  
  db_name  = "zeal_traces"
  username = "zeal_user"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  multi_az               = var.environment == "production"
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  performance_insights_enabled = true
  
  tags = {
    Name = "${var.cluster_name}-timescaledb"
  }
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.cluster_name}-cache-subnet"
  subnet_ids = module.vpc.private_subnets
}

resource "random_password" "redis_auth" {
  length  = 32
  special = false  # Redis doesn't like special characters in auth
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.cluster_name}-redis"
  replication_group_description = "Redis for Zeal"
  
  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.elasticache_node_type
  number_cache_clusters = var.environment == "production" ? 2 : 1
  port                 = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.elasticache.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = random_password.redis_auth.result
  
  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled          = var.environment == "production"
  
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"
  
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
  
  tags = {
    Name = "${var.cluster_name}-redis"
  }
}

resource "aws_cloudwatch_log_group" "redis" {
  name              = "/aws/elasticache/${var.cluster_name}"
  retention_in_days = 7
}

# S3 Bucket for uploads and backups
resource "aws_s3_bucket" "zeal" {
  bucket = "${var.cluster_name}-${data.aws_caller_identity.current.account_id}"
  
  tags = {
    Name = "${var.cluster_name}-storage"
  }
}

resource "aws_s3_bucket_versioning" "zeal" {
  bucket = aws_s3_bucket.zeal.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "zeal" {
  bucket = aws_s3_bucket.zeal.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "zeal" {
  bucket = aws_s3_bucket.zeal.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "zeal" {
  bucket = aws_s3_bucket.zeal.id
  
  rule {
    id     = "cleanup-old-backups"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    expiration {
      days = 365
    }
  }
}

# ECR Repository for Docker images
resource "aws_ecr_repository" "zeal" {
  name                 = var.cluster_name
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "zeal" {
  repository = aws_ecr_repository.zeal.name
  
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "zeal/db/password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "zeal/redis/auth"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/containerinsights/${var.cluster_name}/application"
  retention_in_days = 30
}

# Route53 Hosted Zone (optional - if you want Terraform to manage DNS)
data "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 0 : 1
  name  = var.domain
}

resource "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain
  
  tags = {
    Name = var.domain
  }
}

# ACM Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain
  validation_method = "DNS"
  
  subject_alternative_names = [
    "*.${var.domain}"
  ]
  
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.create_route53_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.main[0].zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Outputs
output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnets
}

output "public_subnet_ids" {
  value = module.vpc.public_subnets
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "timescaledb_endpoint" {
  value = aws_db_instance.timescaledb.endpoint
}

output "elasticache_endpoint" {
  value = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

output "s3_bucket" {
  value = aws_s3_bucket.zeal.id
}

output "ecr_repository" {
  value = aws_ecr_repository.zeal.repository_url
}

output "acm_certificate_arn" {
  value = aws_acm_certificate.main.arn
}