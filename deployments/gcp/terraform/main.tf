# GCP Infrastructure for Zeal Production Deployment

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.84.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5.0"
    }
  }
  
  backend "gcs" {
    bucket = "zeal-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Data sources
data "google_client_config" "default" {}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "artifactregistry.googleapis.com",
    "certificatemanager.googleapis.com",
    "dns.googleapis.com",
    "servicenetworking.googleapis.com"
  ])
  
  project = var.project_id
  service = each.value
  
  disable_dependent_services = false
  disable_on_destroy        = false
}

# VPC Network
resource "google_compute_network" "main" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
  mtu                     = 1460
  
  depends_on = [google_project_service.required_apis]
}

# Subnets
resource "google_compute_subnetwork" "gke" {
  name          = "${var.cluster_name}-gke-subnet"
  ip_cidr_range = var.gke_subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id
  
  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = var.gke_pods_cidr
  }
  
  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = var.gke_services_cidr
  }
  
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "database" {
  name          = "${var.cluster_name}-db-subnet"
  ip_cidr_range = var.database_subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id
  
  private_ip_google_access = true
}

# Private Service Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.cluster_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Cloud NAT for outbound internet access
resource "google_compute_router" "main" {
  name    = "${var.cluster_name}-router"
  region  = var.region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.cluster_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall Rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.cluster_name}-allow-internal"
  network = google_compute_network.main.name
  
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "icmp"
  }
  
  source_ranges = [
    var.gke_subnet_cidr,
    var.gke_pods_cidr,
    var.gke_services_cidr,
    var.database_subnet_cidr
  ]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.cluster_name}-allow-ssh"
  network = google_compute_network.main.name
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["35.235.240.0/20"] # Google Cloud IAP range
  target_tags   = ["ssh-allowed"]
}

# Secret Manager
resource "random_password" "postgres" {
  length  = 32
  special = true
}

resource "google_secret_manager_secret" "postgres_password" {
  secret_id = "postgres-password"
  
  replication {
    automatic = true
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "postgres_password" {
  secret      = google_secret_manager_secret.postgres_password.id
  secret_data = random_password.postgres.result
}

resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "redis_auth" {
  secret_id = "redis-auth"
  
  replication {
    automatic = true
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "redis_auth" {
  secret      = google_secret_manager_secret.redis_auth.id
  secret_data = random_password.redis.result
}

# Cloud SQL PostgreSQL (Main Database)
resource "google_sql_database_instance" "postgres" {
  name             = "${var.cluster_name}-postgres"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier                        = var.postgres_tier
    availability_type          = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_type                  = "PD_SSD"
    disk_size                  = var.postgres_disk_size
    disk_autoresize           = true
    disk_autoresize_limit     = var.postgres_disk_max_size
    
    backup_configuration {
      enabled                        = true
      start_time                    = "03:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
      transaction_log_retention_days = 7
    }
    
    maintenance_window {
      day         = 7  # Sunday
      hour        = 4
      update_track = "stable"
    }
    
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
      
      require_ssl = true
    }
    
    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }
    
    database_flags {
      name  = "log_statement"
      value = "all"
    }
    
    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
    
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }
  
  deletion_protection = var.environment == "production" ? true : false
  
  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "main" {
  name     = "zeal_db"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "main" {
  name     = "zeal_user"
  instance = google_sql_database_instance.postgres.name
  password = random_password.postgres.result
}

# Cloud SQL TimescaleDB
resource "google_sql_database_instance" "timescale" {
  name             = "${var.cluster_name}-timescale"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier                        = var.timescale_tier
    availability_type          = "ZONAL"
    disk_type                  = "PD_SSD"
    disk_size                  = var.timescale_disk_size
    disk_autoresize           = true
    disk_autoresize_limit     = var.timescale_disk_max_size
    
    backup_configuration {
      enabled                        = true
      start_time                    = "03:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }
    
    maintenance_window {
      day  = 7  # Sunday
      hour = 4
    }
    
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.main.id
      enable_private_path_for_google_cloud_services = true
      
      require_ssl = true
    }
    
    database_flags {
      name  = "shared_preload_libraries"
      value = "timescaledb,pg_stat_statements"
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
    
    database_flags {
      name  = "work_mem"
      value = "256MB"
    }
    
    database_flags {
      name  = "effective_cache_size"
      value = "3GB"
    }
  }
  
  deletion_protection = var.environment == "production" ? true : false
  
  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "timescale" {
  name     = "zeal_traces"
  instance = google_sql_database_instance.timescale.name
}

resource "google_sql_user" "timescale" {
  name     = "zeal_user"
  instance = google_sql_database_instance.timescale.name
  password = random_password.postgres.result
}

# Memorystore Redis
resource "google_redis_instance" "main" {
  name               = "${var.cluster_name}-redis"
  memory_size_gb     = var.redis_memory_size
  region             = var.region
  tier               = var.redis_tier
  
  authorized_network   = google_compute_network.main.id
  redis_version       = "REDIS_7_0"
  display_name        = "Zeal Redis Cache"
  
  auth_enabled            = true
  auth_string             = random_password.redis.result
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  
  persistence_config {
    persistence_mode    = "RDB"
    rdb_snapshot_period = "ONE_HOUR"
  }
  
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# Cloud Storage
resource "google_storage_bucket" "main" {
  name     = "${var.project_id}-zeal-storage"
  location = var.region
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 365
      is_live = false
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 30
      is_live = true
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket" "backups" {
  name     = "${var.project_id}-zeal-backups"
  location = var.region
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Artifact Registry
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "zeal"
  description   = "Docker images for Zeal application"
  format        = "DOCKER"
  
  depends_on = [google_project_service.required_apis]
}

# GKE Cluster
resource "google_service_account" "gke_sa" {
  account_id   = "${var.cluster_name}-gke-sa"
  display_name = "Zeal GKE Service Account"
}

resource "google_project_iam_member" "gke_sa_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/redis.editor",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/monitoring.metricWriter",
    "roles/logging.logWriter",
    "roles/artifactregistry.reader"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_sa.email}"
}

resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.zone
  
  # Use Autopilot for simplified management (optional)
  enable_autopilot = var.enable_autopilot
  
  dynamic "initial_node_count" {
    for_each = var.enable_autopilot ? [] : [1]
    content {
      initial_node_count = 1
    }
  }
  
  network    = google_compute_network.main.name
  subnetwork = google_compute_subnetwork.gke.name
  
  # IP allocation policy for alias IP
  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }
  
  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = var.private_cluster
    master_ipv4_cidr_block  = var.master_ipv4_cidr
    
    master_global_access_config {
      enabled = true
    }
  }
  
  # Master authorized networks
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }
  
  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
  
  # Network policy
  network_policy {
    enabled = true
  }
  
  # Add-on configuration
  addons_config {
    http_load_balancing {
      disabled = false
    }
    
    horizontal_pod_autoscaling {
      disabled = false
    }
    
    network_policy_config {
      disabled = false
    }
    
    gcp_filestore_csi_driver_config {
      enabled = false
    }
    
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }
  
  # Logging and monitoring
  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"
  
  # Enable Shielded Nodes
  node_config {
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
  
  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T04:00:00Z"
      end_time   = "2023-01-01T08:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SU"
    }
  }
  
  # Only create node pool if not using Autopilot
  dynamic "node_pool" {
    for_each = var.enable_autopilot ? [] : [1]
    content {
      name       = "default-pool"
      node_count = var.initial_node_count
      
      node_config {
        machine_type = var.node_machine_type
        disk_size_gb = 100
        disk_type    = "pd-ssd"
        
        oauth_scopes = [
          "https://www.googleapis.com/auth/cloud-platform"
        ]
        
        service_account = google_service_account.gke_sa.email
        
        workload_metadata_config {
          mode = "GKE_METADATA"
        }
        
        shielded_instance_config {
          enable_secure_boot          = true
          enable_integrity_monitoring = true
        }
        
        labels = {
          environment = var.environment
          cluster     = var.cluster_name
        }
        
        tags = ["gke-node", "${var.cluster_name}-gke"]
      }
      
      autoscaling {
        min_node_count = var.min_node_count
        max_node_count = var.max_node_count
      }
      
      management {
        auto_repair  = true
        auto_upgrade = true
      }
      
      upgrade_settings {
        max_surge       = 1
        max_unavailable = 0
      }
    }
  }
  
  # Remove default node pool for non-Autopilot clusters
  dynamic "remove_default_node_pool" {
    for_each = var.enable_autopilot ? [] : [true]
    content {
      remove_default_node_pool = true
    }
  }
  
  depends_on = [
    google_project_service.required_apis,
    google_service_account.gke_sa,
    google_compute_subnetwork.gke
  ]
}

# Additional node pool for workloads (only for non-Autopilot)
resource "google_container_node_pool" "workload" {
  count      = var.enable_autopilot ? 0 : 1
  name       = "workload-pool"
  location   = var.zone
  cluster    = google_container_cluster.main.name
  node_count = var.workload_node_count
  
  node_config {
    machine_type = var.workload_machine_type
    disk_size_gb = 100
    disk_type    = "pd-ssd"
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    
    service_account = google_service_account.gke_sa.email
    
    workload_metadata_config {
      mode = "GKE_METADATA"
    }
    
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
    
    labels = {
      environment = var.environment
      cluster     = var.cluster_name
      pool        = "workload"
    }
    
    taint {
      key    = "workload"
      value  = "zeal"
      effect = "NO_SCHEDULE"
    }
    
    tags = ["gke-workload", "${var.cluster_name}-workload"]
  }
  
  autoscaling {
    min_node_count = var.workload_min_nodes
    max_node_count = var.workload_max_nodes
  }
  
  management {
    auto_repair  = true
    auto_upgrade = true
  }
  
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# Workload Identity binding
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.gke_sa.name
  role               = "roles/iam.workloadIdentityUser"
  
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[zeal-production/zeal-sa]"
  ]
}

# Local Variables
locals {
  common_labels = {
    environment = var.environment
    project     = "zeal"
    managed_by  = "terraform"
    cluster     = var.cluster_name
  }
}

# Add labels to all resources
resource "google_compute_network" "main" {
  labels = local.common_labels
}

resource "google_compute_subnetwork" "gke" {
  labels = local.common_labels
}

resource "google_compute_subnetwork" "database" {
  labels = local.common_labels
}