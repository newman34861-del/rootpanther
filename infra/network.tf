resource "azurerm_subnet" "privatelink" {
  name                 = "snet-privatelink"
  resource_group_name  = local.control_rg
  virtual_network_name = local.control_vnet
  address_prefixes     = [var.privatelink_subnet_cidr]
}

# The flexible server injects itself into this subnet, which is why the delegation is
# required and why nothing else may share it.
resource "azurerm_subnet" "postgres" {
  name                 = "snet-postgres"
  resource_group_name  = local.control_rg
  virtual_network_name = local.control_vnet
  address_prefixes     = [var.postgres_subnet_cidr]

  delegation {
    name = "postgres"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "apps" {
  name                 = "snet-apps"
  resource_group_name  = local.control_rg
  virtual_network_name = local.control_vnet
  address_prefixes     = [var.apps_subnet_cidr]
}

# Private DNS. Without these zones a private endpoint resolves to its public name and
# the connection leaves the network, which defeats the point of having one.
resource "azurerm_private_dns_zone" "vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = local.control_rg
  tags                = var.tags
}

resource "azurerm_private_dns_zone" "postgres" {
  name                = "rootpanther.postgres.database.azure.com"
  resource_group_name = local.control_rg
  tags                = var.tags
}

resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = local.control_rg
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "vault" {
  name                  = "link-vault"
  resource_group_name   = local.control_rg
  private_dns_zone_name = azurerm_private_dns_zone.vault.name
  virtual_network_id    = local.vnet_id
  tags                  = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "link-postgres"
  resource_group_name   = local.control_rg
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = local.vnet_id
  tags                  = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                  = "link-blob"
  resource_group_name   = local.control_rg
  private_dns_zone_name = azurerm_private_dns_zone.blob.name
  virtual_network_id    = local.vnet_id
  tags                  = var.tags
}
