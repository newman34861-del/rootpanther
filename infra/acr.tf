// Container registry.
//
// admin_enabled is false, so the registry has no username and password to issue, leak
// or rotate. The container pulls with its managed identity and nothing else can.
resource "azurerm_container_registry" "main" {
  name                = "acrrootpanther${random_string.storage_suffix.result}"
  resource_group_name = local.control_rg
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = var.tags
}

resource "azurerm_role_assignment" "api_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
}

// The identity that CI uses to push. Granted push only: a build pipeline has no reason
// to be able to delete a published image.
resource "azurerm_role_assignment" "ci_acr_push" {
  count                = var.ci_principal_id == "" ? 0 : 1
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPush"
  principal_id         = var.ci_principal_id
}
