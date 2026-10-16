// User assigned rather than system assigned, deliberately.
//
// A system assigned identity only exists once the container app exists, so every grant
// it needs depends on the app, while the app needs the registry grant in order to pull.
// Creating the identity first breaks that ordering problem: the grants are in place
// before anything tries to use them.
resource "azurerm_user_assigned_identity" "api" {
  name                = "id-rootpanther-api"
  resource_group_name = local.control_rg
  location            = var.location
  tags                = var.tags
}
