# Azure Infrastructure for Zeal Production Deployment

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.75.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0.0"
    }
  }
  
  backend "azurerm" {
    resource_group_name  = "zeal-terraform-state"
    storage_account_name = "zealtfstate"
    container_name      = "tfstate"
    key                 = "production.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults  = true
    }
    
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Data sources
data "azurerm_client_config" "current" {}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  
  tags = local.common_tags
}

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${var.cluster_name}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = [var.vnet_address_space]
  
  tags = local.common_tags
}

# Subnets
resource "azurerm_subnet" "aks" {
  name                 = "aks-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.aks_subnet_cidr]
  
  service_endpoints = [
    "Microsoft.Storage",
    "Microsoft.Sql",
    "Microsoft.KeyVault"
  ]
}

resource "azurerm_subnet" "database" {
  name                 = "database-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.database_subnet_cidr]
  
  delegation {
    name = "fs"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }
}

resource "azurerm_subnet" "redis" {
  name                 = "redis-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.redis_subnet_cidr]
}

resource "azurerm_subnet" "gateway" {
  name                 = "gateway-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.gateway_subnet_cidr]
}

# Network Security Groups
resource "azurerm_network_security_group" "aks" {
  name                = "${var.cluster_name}-aks-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  security_rule {
    name                       = "allow-https"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
  
  security_rule {
    name                       = "allow-http"
    priority                   = 101
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
  
  tags = local.common_tags
}

resource "azurerm_subnet_network_security_group_association" "aks" {
  subnet_id                 = azurerm_subnet.aks.id
  network_security_group_id = azurerm_network_security_group.aks.id
}

# Key Vault
resource "azurerm_key_vault" "main" {
  name                       = "${var.cluster_name}-kv-${random_string.kv_suffix.result}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = true
  
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    
    virtual_network_subnet_ids = [
      azurerm_subnet.aks.id
    ]
  }
  
  tags = local.common_tags
}

resource "azurerm_key_vault_access_policy" "current" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id
  
  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Purge",
    "Recover"
  ]
  
  key_permissions = [
    "Get",
    "List",
    "Create",
    "Delete",
    "Purge",
    "Recover"
  ]
}

# PostgreSQL Flexible Server
resource "random_password" "postgres" {
  length  = 32
  special = true
}

resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "postgres-password"
  value        = random_password.postgres.result
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [azurerm_key_vault_access_policy.current]
}

resource "azurerm_private_dns_zone" "postgres" {
  name                = "${var.cluster_name}.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name
  
  tags = local.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "${var.cluster_name}-postgres-link"
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  resource_group_name   = azurerm_resource_group.main.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "${var.cluster_name}-postgres"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "15"
  delegated_subnet_id    = azurerm_subnet.database.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres.id
  administrator_login    = "zealadmin"
  administrator_password = random_password.postgres.result
  zone                   = var.availability_zone
  
  storage_mb = var.postgres_storage_mb
  sku_name   = var.postgres_sku
  
  backup_retention_days        = 30
  geo_redundant_backup_enabled = var.environment == "production" ? true : false
  auto_grow_enabled            = true
  
  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = var.standby_availability_zone
  }
  
  maintenance_window {
    day_of_week  = 0
    start_hour   = 2
    start_minute = 0
  }
  
  tags = local.common_tags
  
  depends_on = [
    azurerm_private_dns_zone_virtual_network_link.postgres
  ]
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "zeal_db"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# PostgreSQL for TimescaleDB
resource "azurerm_postgresql_flexible_server" "timescale" {
  name                   = "${var.cluster_name}-timescale"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "15"
  delegated_subnet_id    = azurerm_subnet.database.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres.id
  administrator_login    = "zealadmin"
  administrator_password = random_password.postgres.result
  zone                   = var.availability_zone
  
  storage_mb = var.timescale_storage_mb
  sku_name   = var.timescale_sku
  
  backup_retention_days = 30
  auto_grow_enabled    = true
  
  tags = local.common_tags
  
  depends_on = [
    azurerm_private_dns_zone_virtual_network_link.postgres,
    azurerm_postgresql_flexible_server.main
  ]
}

resource "azurerm_postgresql_flexible_server_database" "timescale" {
  name      = "zeal_traces"
  server_id = azurerm_postgresql_flexible_server.timescale.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_configuration" "timescale_extension" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.timescale.id
  value     = "TIMESCALEDB"
}

# Redis Cache
resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "azurerm_key_vault_secret" "redis_key" {
  name         = "redis-key"
  value        = random_password.redis.result
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [azurerm_key_vault_access_policy.current]
}

resource "azurerm_redis_cache" "main" {
  name                = "${var.cluster_name}-redis"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku
  
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  
  redis_configuration {
    enable_authentication = true
    maxmemory_policy     = "allkeys-lru"
    maxmemory_reserved   = 200
    maxmemory_delta      = 200
    
    rdb_backup_enabled            = var.environment == "production" ? true : false
    rdb_backup_frequency          = var.environment == "production" ? 60 : null
    rdb_backup_max_snapshot_count = var.environment == "production" ? 1 : null
  }
  
  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 3
  }
  
  tags = local.common_tags
}

# Storage Account
resource "azurerm_storage_account" "main" {
  name                     = "${lower(replace(var.cluster_name, "-", ""))}storage"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = var.environment == "production" ? "GRS" : "LRS"
  min_tls_version          = "TLS1_2"
  
  blob_properties {
    versioning_enabled = true
    
    delete_retention_policy {
      days = 30
    }
    
    container_delete_retention_policy {
      days = 30
    }
  }
  
  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = [azurerm_subnet.aks.id]
  }
  
  tags = local.common_tags
}

resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "backups" {
  name                  = "backups"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_key_vault_secret" "storage_connection_string" {
  name         = "storage-connection-string"
  value        = azurerm_storage_account.main.primary_connection_string
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [azurerm_key_vault_access_policy.current]
}

# Container Registry
resource "azurerm_container_registry" "main" {
  name                = "${lower(replace(var.cluster_name, "-", ""))}registry"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.environment == "production" ? "Premium" : "Standard"
  admin_enabled       = false
  
  network_rule_set = var.environment == "production" ? [{
    default_action = "Deny"
    
    virtual_network = [{
      action    = "Allow"
      subnet_id = azurerm_subnet.aks.id
    }]
  }] : []
  
  georeplications = var.environment == "production" ? [
    {
      location                = "West US"
      zone_redundancy_enabled = true
      tags                   = {}
    }
  ] : []
  
  tags = local.common_tags
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.cluster_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  
  tags = local.common_tags
}

resource "azurerm_log_analytics_solution" "container_insights" {
  solution_name         = "ContainerInsights"
  location              = azurerm_resource_group.main.location
  resource_group_name   = azurerm_resource_group.main.name
  workspace_resource_id = azurerm_log_analytics_workspace.main.id
  workspace_name        = azurerm_log_analytics_workspace.main.name
  
  plan {
    publisher = "Microsoft"
    product   = "OMSGallery/ContainerInsights"
  }
  
  tags = local.common_tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "${var.cluster_name}-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  
  tags = local.common_tags
}

resource "azurerm_key_vault_secret" "app_insights_key" {
  name         = "app-insights-instrumentation-key"
  value        = azurerm_application_insights.main.instrumentation_key
  key_vault_id = azurerm_key_vault.main.id
  
  depends_on = [azurerm_key_vault_access_policy.current]
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = var.cluster_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = var.cluster_name
  
  kubernetes_version = var.kubernetes_version
  
  default_node_pool {
    name                = "system"
    node_count          = var.node_count
    vm_size            = var.node_vm_size
    vnet_subnet_id     = azurerm_subnet.aks.id
    type               = "VirtualMachineScaleSets"
    enable_auto_scaling = true
    min_count          = var.node_min_count
    max_count          = var.node_max_count
    max_pods           = 110
    zones              = ["1", "2", "3"]
    
    node_labels = {
      "nodepool" = "system"
    }
    
    tags = local.common_tags
  }
  
  identity {
    type = "SystemAssigned"
  }
  
  network_profile {
    network_plugin     = "azure"
    network_mode      = "transparent"
    network_policy    = "azure"
    dns_service_ip    = "10.2.0.10"
    service_cidr      = "10.2.0.0/16"
    load_balancer_sku = "standard"
  }
  
  addon_profile {
    oms_agent {
      enabled                    = true
      log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
    }
    
    azure_policy {
      enabled = true
    }
    
    azure_keyvault_secrets_provider {
      enabled                  = true
      secret_rotation_enabled  = true
      secret_rotation_interval = "2m"
    }
    
    ingress_application_gateway {
      enabled    = false
    }
  }
  
  auto_scaler_profile {
    balance_similar_node_groups      = true
    expander                         = "random"
    max_graceful_termination_sec     = 600
    max_node_provisioning_time       = "15m"
    max_unready_nodes                = 3
    max_unready_percentage           = 45
    new_pod_scale_up_delay           = "0s"
    scale_down_delay_after_add       = "10m"
    scale_down_delay_after_delete    = "10s"
    scale_down_delay_after_failure   = "3m"
    scan_interval                    = "10s"
    scale_down_unneeded              = "10m"
    scale_down_unready               = "20m"
    scale_down_utilization_threshold = 0.5
    empty_bulk_delete_max            = 10
    skip_nodes_with_local_storage    = true
    skip_nodes_with_system_pods      = true
  }
  
  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [2, 3, 4, 5]
    }
  }
  
  tags = local.common_tags
}

# Additional Node Pool for Workloads
resource "azurerm_kubernetes_cluster_node_pool" "workload" {
  name                  = "workload"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = var.workload_node_vm_size
  node_count           = var.workload_node_count
  vnet_subnet_id       = azurerm_subnet.aks.id
  
  enable_auto_scaling = true
  min_count          = var.workload_node_min_count
  max_count          = var.workload_node_max_count
  max_pods           = 110
  zones              = ["1", "2", "3"]
  
  node_labels = {
    "nodepool" = "workload"
    "workload" = "zeal"
  }
  
  node_taints = [
    "workload=zeal:NoSchedule"
  ]
  
  tags = local.common_tags
}

# Role Assignments
resource "azurerm_role_assignment" "aks_acr" {
  principal_id                     = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                            = azurerm_container_registry.main.id
  skip_service_principal_aad_check = true
}

resource "azurerm_role_assignment" "aks_keyvault" {
  principal_id                     = azurerm_kubernetes_cluster.main.key_vault_secrets_provider[0].secret_identity[0].object_id
  role_definition_name             = "Key Vault Secrets User"
  scope                            = azurerm_key_vault.main.id
  skip_service_principal_aad_check = true
}

# Random Strings
resource "random_string" "kv_suffix" {
  length  = 4
  special = false
  upper   = false
}

# Local Variables
locals {
  common_tags = {
    Environment = var.environment
    Project     = "Zeal"
    ManagedBy   = "Terraform"
    Cluster     = var.cluster_name
  }
}