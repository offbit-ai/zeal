# Project and Region Outputs
output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region where resources are deployed"
  value       = var.region
}

output "zone" {
  description = "GCP zone where zonal resources are deployed"
  value       = var.zone
}

# Network Outputs
output "vpc_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.main.name
}

output "vpc_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.main.id
}

output "subnet_name" {
  description = "Name of the GKE subnet"
  value       = google_compute_subnetwork.gke.name
}

output "subnet_id" {
  description = "ID of the GKE subnet"
  value       = google_compute_subnetwork.gke.id
}

output "database_subnet_name" {
  description = "Name of the database subnet"
  value       = google_compute_subnetwork.database.name
}

output "database_subnet_id" {
  description = "ID of the database subnet"
  value       = google_compute_subnetwork.database.id
}

# GKE Cluster Outputs
output "cluster_name" {
  description = "Name of the GKE cluster"
  value       = google_container_cluster.main.name
}

output "cluster_id" {
  description = "ID of the GKE cluster"
  value       = google_container_cluster.main.id
}

output "cluster_endpoint" {
  description = "Endpoint of the GKE cluster"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "CA certificate of the GKE cluster"
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "cluster_location" {
  description = "Location of the GKE cluster"
  value       = google_container_cluster.main.location
}

output "cluster_self_link" {
  description = "Self link of the GKE cluster"
  value       = google_container_cluster.main.self_link
}

output "cluster_service_account" {
  description = "Service account used by the GKE cluster"
  value       = google_service_account.gke_sa.email
}

# Cloud SQL Outputs
output "cloud_sql_instance" {
  description = "Connection name of the Cloud SQL PostgreSQL instance"
  value       = google_sql_database_instance.postgres.connection_name
}

output "postgres_instance_name" {
  description = "Name of the PostgreSQL instance"
  value       = google_sql_database_instance.postgres.name
}

output "postgres_private_ip" {
  description = "Private IP address of the PostgreSQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "postgres_database_name" {
  description = "Name of the PostgreSQL database"
  value       = google_sql_database.main.name
}

output "postgres_user_name" {
  description = "Name of the PostgreSQL user"
  value       = google_sql_user.main.name
}

output "timescale_instance_name" {
  description = "Name of the TimescaleDB instance"
  value       = google_sql_database_instance.timescale.name
}

output "timescale_connection_name" {
  description = "Connection name of the TimescaleDB instance"
  value       = google_sql_database_instance.timescale.connection_name
}

output "timescale_private_ip" {
  description = "Private IP address of the TimescaleDB instance"
  value       = google_sql_database_instance.timescale.private_ip_address
}

output "timescale_database_name" {
  description = "Name of the TimescaleDB database"
  value       = google_sql_database.timescale.name
}

# Redis Outputs
output "redis_instance" {
  description = "ID of the Redis instance"
  value       = google_redis_instance.main.id
}

output "redis_host" {
  description = "Host of the Redis instance"
  value       = google_redis_instance.main.host
}

output "redis_port" {
  description = "Port of the Redis instance"
  value       = google_redis_instance.main.port
}

output "redis_name" {
  description = "Name of the Redis instance"
  value       = google_redis_instance.main.name
}

# Storage Outputs
output "gcs_bucket" {
  description = "Name of the main Cloud Storage bucket"
  value       = google_storage_bucket.main.name
}

output "gcs_bucket_url" {
  description = "URL of the main Cloud Storage bucket"
  value       = google_storage_bucket.main.url
}

output "backup_bucket" {
  description = "Name of the backup Cloud Storage bucket"
  value       = google_storage_bucket.backups.name
}

output "backup_bucket_url" {
  description = "URL of the backup Cloud Storage bucket"
  value       = google_storage_bucket.backups.url
}

# Artifact Registry Outputs
output "artifact_registry" {
  description = "Name of the Artifact Registry repository"
  value       = google_artifact_registry_repository.main.name
}

output "artifact_registry_url" {
  description = "URL of the Artifact Registry repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}

# Secret Manager Outputs
output "postgres_secret_name" {
  description = "Name of the PostgreSQL password secret"
  value       = google_secret_manager_secret.postgres_password.secret_id
}

output "redis_secret_name" {
  description = "Name of the Redis auth secret"
  value       = google_secret_manager_secret.redis_auth.secret_id
}

# Service Account Outputs
output "gke_service_account" {
  description = "Email of the GKE service account"
  value       = google_service_account.gke_sa.email
}

output "gke_service_account_name" {
  description = "Name of the GKE service account"
  value       = google_service_account.gke_sa.name
}

# Connection Information
output "database_connection_name" {
  description = "Cloud SQL connection name for proxy"
  value       = google_sql_database_instance.postgres.connection_name
}

output "timescale_connection_name" {
  description = "TimescaleDB connection name for proxy"
  value       = google_sql_database_instance.timescale.connection_name
}

output "database_url" {
  description = "Database URL template for applications"
  value       = "postgresql://zeal_user:$(DATABASE_PASSWORD)@localhost:5432/zeal_db?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}"
  sensitive   = false
}

output "timescale_url" {
  description = "TimescaleDB URL template for applications"
  value       = "postgresql://zeal_user:$(DATABASE_PASSWORD)@localhost:5433/zeal_traces?host=/cloudsql/${google_sql_database_instance.timescale.connection_name}"
  sensitive   = false
}

output "redis_url" {
  description = "Redis URL template for applications"
  value       = "redis://:$(REDIS_AUTH)@${google_redis_instance.main.host}:${google_redis_instance.main.port}"
  sensitive   = false
}

# Kubectl Configuration
output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.main.name} --zone ${google_container_cluster.main.location} --project ${var.project_id}"
}

# Deployment Summary
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    project_id       = var.project_id
    cluster_name     = google_container_cluster.main.name
    cluster_location = google_container_cluster.main.location
    postgres_instance = google_sql_database_instance.postgres.name
    timescale_instance = google_sql_database_instance.timescale.name
    redis_instance   = google_redis_instance.main.name
    storage_bucket   = google_storage_bucket.main.name
    backup_bucket    = google_storage_bucket.backups.name
    artifact_registry = google_artifact_registry_repository.main.name
    service_account  = google_service_account.gke_sa.email
  }
}

# Monitoring and Logging Endpoints
output "monitoring_dashboard_url" {
  description = "URL to GCP Monitoring dashboard"
  value       = "https://console.cloud.google.com/monitoring/dashboards?project=${var.project_id}"
}

output "logging_url" {
  description = "URL to GCP Logging"
  value       = "https://console.cloud.google.com/logs?project=${var.project_id}"
}

# Cloud SQL Admin URLs
output "postgres_admin_url" {
  description = "URL to PostgreSQL instance in Cloud Console"
  value       = "https://console.cloud.google.com/sql/instances/${google_sql_database_instance.postgres.name}/overview?project=${var.project_id}"
}

output "timescale_admin_url" {
  description = "URL to TimescaleDB instance in Cloud Console"
  value       = "https://console.cloud.google.com/sql/instances/${google_sql_database_instance.timescale.name}/overview?project=${var.project_id}"
}

# GKE Console URL
output "gke_console_url" {
  description = "URL to GKE cluster in Cloud Console"
  value       = "https://console.cloud.google.com/kubernetes/clusters/details/${google_container_cluster.main.location}/${google_container_cluster.main.name}?project=${var.project_id}"
}