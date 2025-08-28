# Resource Group Outputs
output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_id" {
  description = "ID of the created resource group"
  value       = azurerm_resource_group.main.id
}

output "location" {
  description = "Azure region where resources are deployed"
  value       = azurerm_resource_group.main.location
}

# Network Outputs
output "vnet_id" {
  description = "ID of the created Virtual Network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the created Virtual Network"
  value       = azurerm_virtual_network.main.name
}

output "aks_subnet_id" {
  description = "ID of the AKS subnet"
  value       = azurerm_subnet.aks.id
}

output "database_subnet_id" {
  description = "ID of the database subnet"
  value       = azurerm_subnet.database.id
}

# AKS Cluster Outputs
output "cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "cluster_id" {
  description = "ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
}

output "cluster_identity" {
  description = "System assigned identity of the AKS cluster"
  value = {
    type         = azurerm_kubernetes_cluster.main.identity[0].type
    principal_id = azurerm_kubernetes_cluster.main.identity[0].principal_id
    tenant_id    = azurerm_kubernetes_cluster.main.identity[0].tenant_id
  }
}

output "kubelet_identity" {
  description = "Kubelet identity of the AKS cluster"
  value = {
    client_id                 = azurerm_kubernetes_cluster.main.kubelet_identity[0].client_id
    object_id                = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
    user_assigned_identity_id = azurerm_kubernetes_cluster.main.kubelet_identity[0].user_assigned_identity_id
  }
}

# Database Outputs
output "postgres_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_server_name" {
  description = "Name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "postgres_database_name" {
  description = "Name of the PostgreSQL database"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "postgres_connection_string" {
  description = "Connection string for PostgreSQL (without password)"
  value       = "postgresql://zealadmin@${azurerm_postgresql_flexible_server.main.fqdn}/zeal_db?sslmode=require"
  sensitive   = false
}

output "timescale_fqdn" {
  description = "FQDN of the TimescaleDB server"
  value       = azurerm_postgresql_flexible_server.timescale.fqdn
}

output "timescale_server_name" {
  description = "Name of the TimescaleDB server"
  value       = azurerm_postgresql_flexible_server.timescale.name
}

output "timescale_database_name" {
  description = "Name of the TimescaleDB database"
  value       = azurerm_postgresql_flexible_server_database.timescale.name
}

# Redis Outputs
output "redis_hostname" {
  description = "Hostname of the Redis cache"
  value       = azurerm_redis_cache.main.hostname
}

output "redis_name" {
  description = "Name of the Redis cache"
  value       = azurerm_redis_cache.main.name
}

output "redis_port" {
  description = "Port of the Redis cache"
  value       = azurerm_redis_cache.main.port
}

output "redis_ssl_port" {
  description = "SSL port of the Redis cache"
  value       = azurerm_redis_cache.main.ssl_port
}

output "redis_connection_string" {
  description = "Connection string for Redis (without auth token)"
  value       = "${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
  sensitive   = false
}

# Storage Outputs
output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_primary_endpoint" {
  description = "Primary blob endpoint of the storage account"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "uploads_container_name" {
  description = "Name of the uploads container"
  value       = azurerm_storage_container.uploads.name
}

output "backups_container_name" {
  description = "Name of the backups container"
  value       = azurerm_storage_container.backups.name
}

# Container Registry Outputs
output "container_registry_name" {
  description = "Name of the container registry"
  value       = azurerm_container_registry.main.name
}

output "container_registry_id" {
  description = "ID of the container registry"
  value       = azurerm_container_registry.main.id
}

output "container_registry_login_server" {
  description = "Login server of the container registry"
  value       = azurerm_container_registry.main.login_server
}

# Key Vault Outputs
output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.main.name
}

output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = azurerm_key_vault.main.id
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = azurerm_key_vault.main.vault_uri
}

# Monitoring Outputs
output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.main.id
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.main.name
}

output "application_insights_name" {
  description = "Name of Application Insights"
  value       = azurerm_application_insights.main.name
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_app_id" {
  description = "App ID for Application Insights"
  value       = azurerm_application_insights.main.app_id
}

# Connection Information for Kubernetes ConfigMaps
output "database_url" {
  description = "Database URL for ConfigMap"
  value       = "postgresql://zealladmin:$(DATABASE_PASSWORD)@${azurerm_postgresql_flexible_server.main.fqdn}/zeal_db?sslmode=require"
  sensitive   = false
}

output "timescale_url" {
  description = "TimescaleDB URL for ConfigMap"
  value       = "postgresql://zealadmin:$(DATABASE_PASSWORD)@${azurerm_postgresql_flexible_server.timescale.fqdn}/zeal_traces?sslmode=require"
  sensitive   = false
}

output "redis_url" {
  description = "Redis URL for ConfigMap"
  value       = "redis://:$(REDIS_KEY)@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}?ssl=true"
  sensitive   = false
}

# Deployment Summary
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    cluster_name     = azurerm_kubernetes_cluster.main.name
    cluster_location = azurerm_resource_group.main.location
    postgres_server  = azurerm_postgresql_flexible_server.main.fqdn
    timescale_server = azurerm_postgresql_flexible_server.timescale.fqdn
    redis_server     = azurerm_redis_cache.main.hostname
    storage_account  = azurerm_storage_account.main.name
    container_registry = azurerm_container_registry.main.login_server
    key_vault        = azurerm_key_vault.main.name
  }
}