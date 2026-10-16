resource "azurerm_container_app_environment" "main" {
  name                       = "cae-rootpanther"
  resource_group_name        = local.control_rg
  location                   = var.location
  log_analytics_workspace_id = local.workspace_id
  infrastructure_subnet_id   = azurerm_subnet.apps.id
  // Ingress stays public: the two browser apps call this API directly. Everything the
  // API reaches outward (vault, database, storage) is private.
  internal_load_balancer_enabled = false
  tags                           = var.tags
}

resource "azurerm_container_app" "api" {
  name                         = "ca-rootpanther-api"
  resource_group_name          = local.control_rg
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type = "SystemAssigned"
  }

  template {
    // Scales to zero when idle, which is what keeps the bill proportional to use before
    // there are paying learners.
    min_replicas = 0
    max_replicas = 10

    container {
      name   = "api"
      image  = var.api_image
      cpu    = 0.5
      memory = "1Gi"

      liveness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/health"
      }

      readiness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/health/ready"
      }
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = 50
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  lifecycle {
    # The image is rolled by the deploy pipeline, not by this stack.
    ignore_changes = [template[0].container[0].image]
  }
}
