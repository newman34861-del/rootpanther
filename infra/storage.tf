resource "random_string" "storage_suffix" {
  length  = 6
  lower   = true
  numeric = true
  upper   = false
  special = false
}

// Holds report exports, evidence uploads and issued OpenVPN profiles. All of those are
// learner data, so the account is private and reachable only from inside the network.
resource "azurerm_storage_account" "artifacts" {
  name                            = "strpartifacts${random_string.storage_suffix.result}"
  resource_group_name             = local.control_rg
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  public_network_access_enabled   = false
  tags                            = var.tags

  blob_properties {
    delete_retention_policy {
      days = 30
    }
    versioning_enabled = true
  }
}

resource "azurerm_storage_container" "exports" {
  name                  = "exports"
  storage_account_id    = azurerm_storage_account.artifacts.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "evidence" {
  name                  = "evidence"
  storage_account_id    = azurerm_storage_account.artifacts.id
  container_access_type = "private"
}

resource "azurerm_private_endpoint" "blob" {
  name                = "pe-strpartifacts"
  resource_group_name = local.control_rg
  location            = var.location
  subnet_id           = azurerm_subnet.privatelink.id
  tags                = var.tags

  private_service_connection {
    name                           = "psc-blob"
    private_connection_resource_id = azurerm_storage_account.artifacts.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "blob"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

// Shared keys are disabled on the account, so the API authenticates with its identity.
resource "azurerm_role_assignment" "api_blob" {
  scope                = azurerm_storage_account.artifacts.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
}
