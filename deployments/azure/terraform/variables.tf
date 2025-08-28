variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "zeal-production-rg"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
  default     = "zeal-aks"
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

# Network Configuration
variable "vnet_address_space" {
  description = "Address space for the VNet"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aks_subnet_cidr" {
  description = "CIDR block for AKS subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "database_subnet_cidr" {
  description = "CIDR block for database subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "redis_subnet_cidr" {
  description = "CIDR block for Redis subnet"
  type        = string
  default     = "10.0.3.0/24"
}

variable "gateway_subnet_cidr" {
  description = "CIDR block for gateway subnet"
  type        = string
  default     = "10.0.4.0/24"
}

# AKS Configuration
variable "kubernetes_version" {
  description = "Kubernetes version for AKS cluster"
  type        = string
  default     = "1.28"
}

variable "node_count" {
  description = "Number of nodes in the default node pool"
  type        = number
  default     = 3
}

variable "node_min_count" {
  description = "Minimum number of nodes in auto-scaling"
  type        = number
  default     = 2
}

variable "node_max_count" {
  description = "Maximum number of nodes in auto-scaling"
  type        = number
  default     = 10
}

variable "node_vm_size" {
  description = "VM size for AKS nodes"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "workload_node_count" {
  description = "Number of nodes in the workload node pool"
  type        = number
  default     = 3
}

variable "workload_node_min_count" {
  description = "Minimum number of workload nodes"
  type        = number
  default     = 1
}

variable "workload_node_max_count" {
  description = "Maximum number of workload nodes"
  type        = number
  default     = 20
}

variable "workload_node_vm_size" {
  description = "VM size for workload nodes"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "availability_zone" {
  description = "Availability zone for database instances"
  type        = string
  default     = "1"
}

variable "standby_availability_zone" {
  description = "Standby availability zone for high availability"
  type        = string
  default     = "2"
}

# PostgreSQL Configuration
variable "postgres_sku" {
  description = "SKU for PostgreSQL Flexible Server"
  type        = string
  default     = "GP_Standard_D4s_v3"
}

variable "postgres_storage_mb" {
  description = "Storage size in MB for PostgreSQL"
  type        = number
  default     = 131072  # 128GB
}

variable "timescale_sku" {
  description = "SKU for TimescaleDB instance"
  type        = string
  default     = "GP_Standard_D4s_v3"
}

variable "timescale_storage_mb" {
  description = "Storage size in MB for TimescaleDB"
  type        = number
  default     = 262144  # 256GB
}

# Redis Configuration
variable "redis_sku" {
  description = "SKU for Redis Cache"
  type        = string
  default     = "Premium"
  
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.redis_sku)
    error_message = "Redis SKU must be Basic, Standard, or Premium."
  }
}

variable "redis_family" {
  description = "Redis cache family"
  type        = string
  default     = "P"
  
  validation {
    condition     = contains(["C", "P"], var.redis_family)
    error_message = "Redis family must be C (Basic/Standard) or P (Premium)."
  }
}

variable "redis_capacity" {
  description = "Redis cache capacity"
  type        = number
  default     = 1
  
  validation {
    condition     = var.redis_capacity >= 1 && var.redis_capacity <= 120
    error_message = "Redis capacity must be between 1 and 120."
  }
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "Log Analytics workspace retention in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 730
    error_message = "Log retention must be between 30 and 730 days."
  }
}

# Backup Configuration
variable "backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}

# Feature Flags
variable "enable_high_availability" {
  description = "Enable high availability for databases"
  type        = bool
  default     = true
}

variable "enable_geo_redundancy" {
  description = "Enable geo-redundant backups"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable Azure Monitor integration"
  type        = bool
  default     = true
}

variable "enable_policy" {
  description = "Enable Azure Policy for AKS"
  type        = bool
  default     = true
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}