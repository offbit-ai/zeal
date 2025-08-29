# AI Integration Services for Zeal on Azure
# This module deploys OpenAI Functions and MCP servers on AKS

# Resource Group for AI Services (uses main RG)
locals {
  ai_resource_group_name = azurerm_resource_group.main.name
  ai_location           = azurerm_resource_group.main.location
}

# Container Registry for AI Images
resource "azurerm_container_registry" "ai" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                = "${replace(var.cluster_name, "-", "")}airegistry"
  resource_group_name = local.ai_resource_group_name
  location           = local.ai_location
  sku                = "Premium"
  admin_enabled      = true
  
  georeplications {
    location                = "West US"
    zone_redundancy_enabled = true
  }
}

# Storage Account for GraphRAG data
resource "azurerm_storage_account" "graphrag" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                     = "${replace(var.cluster_name, "-", "")}graphrag"
  resource_group_name      = local.ai_resource_group_name
  location                = local.ai_location
  account_tier            = "Standard"
  account_replication_type = "ZRS"
  
  blob_properties {
    versioning_enabled = true
  }
}

resource "azurerm_storage_container" "graphrag" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                  = "graphrag-data"
  storage_account_name  = azurerm_storage_account.graphrag[0].name
  container_access_type = "private"
}

# Azure Container Instances for AI Services (alternative to AKS deployment)
resource "azurerm_container_group" "openai_functions" {
  count = var.enable_ai_integrations && var.use_container_instances ? 1 : 0
  
  name                = "${var.cluster_name}-openai-functions"
  location            = local.ai_location
  resource_group_name = local.ai_resource_group_name
  os_type            = "Linux"
  
  container {
    name   = "openai-functions"
    image  = "${azurerm_container_registry.ai[0].login_server}/openai-functions:${var.ai_service_version}"
    cpu    = var.ai_service_cpu
    memory = var.ai_service_memory
    
    ports {
      port     = 3456
      protocol = "TCP"
    }
    
    environment_variables = {
      PORT             = "3456"
      NODE_ENV         = var.environment
      ZEAL_API_URL     = "http://${azurerm_kubernetes_cluster.main.fqdn}:3000"
      REDIS_URL        = "redis://${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
    }
    
    secure_environment_variables = {
      ZEAL_API_KEY     = azurerm_key_vault_secret.zeal_api_key.value
      JWT_SECRET       = azurerm_key_vault_secret.jwt_secret.value
      REDIS_PASSWORD   = azurerm_redis_cache.main.primary_access_key
    }
    
    liveness_probe {
      exec {
        command = ["curl", "-f", "http://localhost:3456/health"]
      }
      initial_delay_seconds = 30
      period_seconds       = 30
    }
  }
  
  image_registry_credential {
    server   = azurerm_container_registry.ai[0].login_server
    username = azurerm_container_registry.ai[0].admin_username
    password = azurerm_container_registry.ai[0].admin_password
  }
}

resource "azurerm_container_group" "mcp_server" {
  count = var.enable_ai_integrations && var.use_container_instances ? 1 : 0
  
  name                = "${var.cluster_name}-mcp-server"
  location            = local.ai_location
  resource_group_name = local.ai_resource_group_name
  os_type            = "Linux"
  
  container {
    name   = "mcp-server"
    image  = "${azurerm_container_registry.ai[0].login_server}/mcp-server:${var.ai_service_version}"
    cpu    = var.ai_service_cpu
    memory = var.ai_service_memory
    
    ports {
      port     = 3457
      protocol = "TCP"
    }
    
    environment_variables = {
      PORT                   = "3457"
      MCP_TRANSPORT         = "http"
      NODE_ENV              = var.environment
      ZEAL_API_URL          = "http://${azurerm_kubernetes_cluster.main.fqdn}:3000"
      ENABLE_AI_OPTIMIZATION = "true"
      ENABLE_AUTO_DESIGN    = "true"
    }
    
    secure_environment_variables = {
      ZEAL_API_KEY       = azurerm_key_vault_secret.zeal_api_key.value
      OPENROUTER_API_KEY = azurerm_key_vault_secret.openrouter_api_key[0].value
    }
    
    volume {
      name       = "graphrag-data"
      mount_path = "/app/data"
      read_only  = true
      
      storage_account_name = azurerm_storage_account.graphrag[0].name
      storage_account_key  = azurerm_storage_account.graphrag[0].primary_access_key
      share_name          = azurerm_storage_share.graphrag[0].name
    }
    
    liveness_probe {
      exec {
        command = ["curl", "-f", "http://localhost:3457/health"]
      }
      initial_delay_seconds = 30
      period_seconds       = 30
    }
  }
  
  image_registry_credential {
    server   = azurerm_container_registry.ai[0].login_server
    username = azurerm_container_registry.ai[0].admin_username
    password = azurerm_container_registry.ai[0].admin_password
  }
}

# Azure File Share for GraphRAG
resource "azurerm_storage_share" "graphrag" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                 = "graphrag"
  storage_account_name = azurerm_storage_account.graphrag[0].name
  quota               = 50
}

# Key Vault Secrets for AI
resource "azurerm_key_vault_secret" "openrouter_api_key" {
  count = var.enable_ai_integrations && var.openrouter_api_key != "" ? 1 : 0
  
  name         = "openrouter-api-key"
  value        = var.openrouter_api_key
  key_vault_id = azurerm_key_vault.main.id
}

# Azure Functions for GraphRAG Builder
resource "azurerm_app_service_plan" "graphrag" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                = "${var.cluster_name}-graphrag-plan"
  location            = local.ai_location
  resource_group_name = local.ai_resource_group_name
  kind                = "FunctionApp"
  
  sku {
    tier = "Dynamic"
    size = "Y1"
  }
}

resource "azurerm_function_app" "graphrag_builder" {
  count = var.enable_ai_integrations ? 1 : 0
  
  name                       = "${var.cluster_name}-graphrag-builder"
  location                   = local.ai_location
  resource_group_name        = local.ai_resource_group_name
  app_service_plan_id        = azurerm_app_service_plan.graphrag[0].id
  storage_account_name       = azurerm_storage_account.graphrag[0].name
  storage_account_access_key = azurerm_storage_account.graphrag[0].primary_access_key
  version                    = "~4"
  
  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "node"
    WEBSITE_NODE_DEFAULT_VERSION = "~18"
    DATABASE_URL            = "postgresql://${var.postgres_admin_username}@${azurerm_postgresql_server.main.name}:${var.postgres_admin_password}@${azurerm_postgresql_server.main.fqdn}:5432/${var.postgres_database_name}?sslmode=require"
    OPENROUTER_API_KEY      = var.openrouter_api_key
    STORAGE_ACCOUNT_NAME    = azurerm_storage_account.graphrag[0].name
    STORAGE_ACCOUNT_KEY     = azurerm_storage_account.graphrag[0].primary_access_key
    STORAGE_CONTAINER_NAME  = azurerm_storage_container.graphrag[0].name
  }
  
  identity {
    type = "SystemAssigned"
  }
}

# Application Gateway Rules for AI Services (if using App Gateway)
resource "azurerm_application_gateway_url_path_map" "ai" {
  count = var.enable_ai_integrations && var.use_application_gateway ? 1 : 0
  
  name                               = "ai-path-map"
  resource_group_name                = local.ai_resource_group_name
  application_gateway_name           = azurerm_application_gateway.main[0].name
  default_backend_address_pool_name  = azurerm_application_gateway.main[0].backend_address_pool[0].name
  default_backend_http_settings_name = azurerm_application_gateway.main[0].backend_http_settings[0].name
  
  path_rule {
    name                       = "openai-functions"
    paths                      = ["/openai/*"]
    backend_address_pool_name  = "openai-functions-pool"
    backend_http_settings_name = "openai-functions-settings"
  }
  
  path_rule {
    name                       = "mcp-server"
    paths                      = ["/mcp/*"]
    backend_address_pool_name  = "mcp-server-pool"
    backend_http_settings_name = "mcp-server-settings"
  }
}

# AKS Deployment for AI Services (if not using Container Instances)
resource "kubernetes_namespace" "ai" {
  count = var.enable_ai_integrations && !var.use_container_instances ? 1 : 0
  
  metadata {
    name = "zeal-ai"
    
    labels = {
      app       = "zeal"
      component = "ai"
    }
  }
}

resource "kubernetes_deployment" "openai_functions" {
  count = var.enable_ai_integrations && !var.use_container_instances ? 1 : 0
  
  metadata {
    name      = "openai-functions"
    namespace = kubernetes_namespace.ai[0].metadata[0].name
    
    labels = {
      app       = "openai-functions"
      component = "ai"
    }
  }
  
  spec {
    replicas = var.ai_service_count
    
    selector {
      match_labels = {
        app = "openai-functions"
      }
    }
    
    template {
      metadata {
        labels = {
          app       = "openai-functions"
          component = "ai"
        }
      }
      
      spec {
        container {
          name  = "openai-functions"
          image = "${azurerm_container_registry.ai[0].login_server}/openai-functions:${var.ai_service_version}"
          
          port {
            container_port = 3456
          }
          
          env {
            name  = "PORT"
            value = "3456"
          }
          
          env {
            name  = "NODE_ENV"
            value = var.environment
          }
          
          env {
            name  = "ZEAL_API_URL"
            value = "http://zeal-app.zeal.svc.cluster.local:3000"
          }
          
          env {
            name  = "REDIS_URL"
            value = "redis://:${azurerm_redis_cache.main.primary_access_key}@${azurerm_redis_cache.main.hostname}:${azurerm_redis_cache.main.ssl_port}"
          }
          
          env {
            name = "ZEAL_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.ai_secrets[0].metadata[0].name
                key  = "zeal-api-key"
              }
            }
          }
          
          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.ai_secrets[0].metadata[0].name
                key  = "jwt-secret"
              }
            }
          }
          
          liveness_probe {
            http_get {
              path = "/health"
              port = 3456
            }
            initial_delay_seconds = 30
            period_seconds       = 30
          }
          
          readiness_probe {
            http_get {
              path = "/health"
              port = 3456
            }
            initial_delay_seconds = 10
            period_seconds       = 10
          }
          
          resources {
            requests = {
              cpu    = "${var.ai_service_cpu}m"
              memory = "${var.ai_service_memory}Mi"
            }
            limits = {
              cpu    = "${var.ai_service_cpu * 2}m"
              memory = "${var.ai_service_memory * 2}Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "openai_functions" {
  count = var.enable_ai_integrations && !var.use_container_instances ? 1 : 0
  
  metadata {
    name      = "openai-functions"
    namespace = kubernetes_namespace.ai[0].metadata[0].name
  }
  
  spec {
    selector = {
      app = "openai-functions"
    }
    
    port {
      port        = 3456
      target_port = 3456
      protocol    = "TCP"
    }
    
    type = "ClusterIP"
  }
}

# Similar deployment for MCP Server
resource "kubernetes_deployment" "mcp_server" {
  count = var.enable_ai_integrations && !var.use_container_instances ? 1 : 0
  
  metadata {
    name      = "mcp-server"
    namespace = kubernetes_namespace.ai[0].metadata[0].name
    
    labels = {
      app       = "mcp-server"
      component = "ai"
    }
  }
  
  spec {
    replicas = var.ai_service_count
    
    selector {
      match_labels = {
        app = "mcp-server"
      }
    }
    
    template {
      metadata {
        labels = {
          app       = "mcp-server"
          component = "ai"
        }
      }
      
      spec {
        container {
          name  = "mcp-server"
          image = "${azurerm_container_registry.ai[0].login_server}/mcp-server:${var.ai_service_version}"
          
          port {
            container_port = 3457
          }
          
          env {
            name  = "PORT"
            value = "3457"
          }
          
          env {
            name  = "MCP_TRANSPORT"
            value = "http"
          }
          
          volume_mount {
            name       = "graphrag-data"
            mount_path = "/app/data"
            read_only  = true
          }
          
          resources {
            requests = {
              cpu    = "${var.ai_service_cpu}m"
              memory = "${var.ai_service_memory}Mi"
            }
            limits = {
              cpu    = "${var.ai_service_cpu * 2}m"
              memory = "${var.ai_service_memory * 2}Mi"
            }
          }
        }
        
        volume {
          name = "graphrag-data"
          
          azure_file {
            secret_name = kubernetes_secret.graphrag_storage[0].metadata[0].name
            share_name  = azurerm_storage_share.graphrag[0].name
          }
        }
      }
    }
  }
}

# Kubernetes Secrets for AI Services
resource "kubernetes_secret" "ai_secrets" {
  count = var.enable_ai_integrations && !var.use_container_instances ? 1 : 0
  
  metadata {
    name      = "ai-secrets"
    namespace = kubernetes_namespace.ai[0].metadata[0].name
  }
  
  data = {
    "zeal-api-key"       = var.zeal_api_key
    "jwt-secret"         = var.jwt_secret
    "openrouter-api-key" = var.openrouter_api_key
  }
}

resource "kubernetes_secret" "graphrag_storage" {
  count = var.enable_ai_integrations && !var.use_container_instances ? 1 : 0
  
  metadata {
    name      = "graphrag-storage"
    namespace = kubernetes_namespace.ai[0].metadata[0].name
  }
  
  data = {
    azurestorageaccountname = azurerm_storage_account.graphrag[0].name
    azurestorageaccountkey  = azurerm_storage_account.graphrag[0].primary_access_key
  }
}