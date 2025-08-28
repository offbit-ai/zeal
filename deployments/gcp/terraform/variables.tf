variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "zeal-gke"
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
variable "gke_subnet_cidr" {
  description = "CIDR range for GKE subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "gke_pods_cidr" {
  description = "CIDR range for GKE pods"
  type        = string
  default     = "10.1.0.0/16"
}

variable "gke_services_cidr" {
  description = "CIDR range for GKE services"
  type        = string
  default     = "10.2.0.0/16"
}

variable "database_subnet_cidr" {
  description = "CIDR range for database subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "master_ipv4_cidr" {
  description = "CIDR range for GKE master nodes"
  type        = string
  default     = "172.16.0.0/28"
}

# GKE Configuration
variable "enable_autopilot" {
  description = "Enable GKE Autopilot mode"
  type        = bool
  default     = false
}

variable "private_cluster" {
  description = "Create a private GKE cluster"
  type        = bool
  default     = true
}

variable "initial_node_count" {
  description = "Initial number of nodes in the default pool"
  type        = number
  default     = 1
}

variable "min_node_count" {
  description = "Minimum number of nodes in auto-scaling"
  type        = number
  default     = 2
}

variable "max_node_count" {
  description = "Maximum number of nodes in auto-scaling"
  type        = number
  default     = 10
}

variable "node_machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "n2-standard-4"
}

variable "workload_node_count" {
  description = "Number of nodes in workload pool"
  type        = number
  default     = 3
}

variable "workload_min_nodes" {
  description = "Minimum workload nodes"
  type        = number
  default     = 1
}

variable "workload_max_nodes" {
  description = "Maximum workload nodes"
  type        = number
  default     = 20
}

variable "workload_machine_type" {
  description = "Machine type for workload nodes"
  type        = string
  default     = "n2-standard-4"
}

# Cloud SQL Configuration
variable "postgres_tier" {
  description = "Machine type for PostgreSQL instance"
  type        = string
  default     = "db-n1-standard-4"
}

variable "postgres_disk_size" {
  description = "Disk size in GB for PostgreSQL"
  type        = number
  default     = 100
}

variable "postgres_disk_max_size" {
  description = "Maximum disk size in GB for PostgreSQL"
  type        = number
  default     = 500
}

variable "timescale_tier" {
  description = "Machine type for TimescaleDB instance"
  type        = string
  default     = "db-n1-standard-4"
}

variable "timescale_disk_size" {
  description = "Disk size in GB for TimescaleDB"
  type        = number
  default     = 200
}

variable "timescale_disk_max_size" {
  description = "Maximum disk size in GB for TimescaleDB"
  type        = number
  default     = 1000
}

# Redis Configuration
variable "redis_tier" {
  description = "Redis tier (BASIC, STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"
  
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be BASIC or STANDARD_HA."
  }
}

variable "redis_memory_size" {
  description = "Memory size in GB for Redis"
  type        = number
  default     = 5
  
  validation {
    condition     = var.redis_memory_size >= 1 && var.redis_memory_size <= 300
    error_message = "Redis memory size must be between 1 and 300 GB."
  }
}

# Storage Configuration
variable "storage_location" {
  description = "Location for Cloud Storage buckets"
  type        = string
  default     = "US"
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 365
    error_message = "Backup retention must be between 1 and 365 days."
  }
}

# Security Configuration
variable "enable_network_policy" {
  description = "Enable network policy for GKE"
  type        = bool
  default     = true
}

variable "enable_pod_security_policy" {
  description = "Enable pod security policy"
  type        = bool
  default     = true
}

variable "enable_shielded_nodes" {
  description = "Enable shielded GKE nodes"
  type        = bool
  default     = true
}

variable "enable_workload_identity" {
  description = "Enable Workload Identity"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable Google Cloud Monitoring"
  type        = bool
  default     = true
}

variable "enable_logging" {
  description = "Enable Google Cloud Logging"
  type        = bool
  default     = true
}

# High Availability Configuration
variable "enable_regional_cluster" {
  description = "Create regional GKE cluster instead of zonal"
  type        = bool
  default     = false
}

variable "enable_database_ha" {
  description = "Enable high availability for databases"
  type        = bool
  default     = true
}

variable "enable_redis_ha" {
  description = "Enable high availability for Redis"
  type        = bool
  default     = true
}

# Cost Optimization
variable "enable_preemptible_nodes" {
  description = "Use preemptible nodes for cost savings"
  type        = bool
  default     = false
}

variable "node_disk_type" {
  description = "Disk type for nodes (pd-standard, pd-ssd)"
  type        = string
  default     = "pd-ssd"
  
  validation {
    condition     = contains(["pd-standard", "pd-ssd"], var.node_disk_type)
    error_message = "Node disk type must be pd-standard or pd-ssd."
  }
}

variable "node_disk_size" {
  description = "Disk size in GB for nodes"
  type        = number
  default     = 100
  
  validation {
    condition     = var.node_disk_size >= 10 && var.node_disk_size <= 1000
    error_message = "Node disk size must be between 10 and 1000 GB."
  }
}

# DNS Configuration
variable "create_dns_zone" {
  description = "Create Cloud DNS zone"
  type        = bool
  default     = false
}

variable "dns_zone_name" {
  description = "Name of the DNS zone"
  type        = string
  default     = ""
}

# Feature Flags
variable "enable_binary_authorization" {
  description = "Enable Binary Authorization"
  type        = bool
  default     = false
}

variable "enable_istio" {
  description = "Enable Istio service mesh"
  type        = bool
  default     = false
}

variable "enable_vertical_pod_autoscaling" {
  description = "Enable Vertical Pod Autoscaling"
  type        = bool
  default     = true
}

variable "enable_horizontal_pod_autoscaling" {
  description = "Enable Horizontal Pod Autoscaling"
  type        = bool
  default     = true
}

# Labels and Tags
variable "additional_labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "node_labels" {
  description = "Additional labels for GKE nodes"
  type        = map(string)
  default     = {}
}

variable "node_tags" {
  description = "Network tags for GKE nodes"
  type        = list(string)
  default     = []
}

# Maintenance Configuration
variable "maintenance_start_time" {
  description = "Start time for maintenance window (RFC3339 format)"
  type        = string
  default     = "2023-01-01T04:00:00Z"
}

variable "maintenance_recurrence" {
  description = "Recurrence pattern for maintenance window"
  type        = string
  default     = "FREQ=WEEKLY;BYDAY=SU"
}