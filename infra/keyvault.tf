// The vault was created with public network access disabled and no private endpoint,
// so its data plane is currently unreachable from anywhere and no secret can be stored
// or read. This gives it exactly one way in, from inside the control network.

resource "azurerm_private_endpoint" "vault" {
  name                = "pe-kv-rootpanther-ctl"
  resource_group_name = local.control_rg
  location            = var.location
  subnet_id           = azurerm_subnet.privatelink.id
  tags                = var.tags

  private_service_connection {
    name                           = "psc-kv"
    private_connection_resource_id = local.key_vault_id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "vault"
    private_dns_zone_ids = [azurerm_private_dns_zone.vault.id]
  }
}

// The API reads its secrets with its managed identity. No secret value is ever placed
// in an environment variable in this file, and none is written to Terraform state.
resource "azurerm_role_assignment" "api_secrets" {
  scope                = local.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
}
