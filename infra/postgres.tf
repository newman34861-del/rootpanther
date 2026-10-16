resource "random_password" "postgres_admin" {
  length           = 32
  special          = true
  min_special      = 2
  override_special = "!#$%*-_=+"
}

// VNet integrated rather than public with a firewall. There is no public endpoint to
// reach at all, so an exposed credential is not by itself enough to connect.
resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "psql-rootpanther"
  resource_group_name           = local.control_rg
  location                      = var.location
  version                       = "16"
  sku_name                      = var.postgres_sku
  storage_mb                    = var.postgres_storage_mb
  auto_grow_enabled             = true
  backup_retention_days         = 14
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = false

  delegated_subnet_id = azurerm_subnet.postgres.id
  private_dns_zone_id = azurerm_private_dns_zone.postgres.id

  administrator_login    = var.postgres_admin_user
  administrator_password = random_password.postgres_admin.result

  tags = var.tags

  lifecycle {
    # Growing storage is a one-way operation in Azure, so a plan must never propose
    # shrinking it back to the variable's value.
    ignore_changes = [storage_mb, zone]
  }

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "rootpanther"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"

  lifecycle {
    prevent_destroy = true
  }
}

// Required for gen_random_uuid(), which every table's primary key default uses.
resource "azurerm_postgresql_flexible_server_configuration" "extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "PGCRYPTO"
}

// The admin credential is written to the vault rather than handed out. Applying this
// stack is what puts it there; nothing reads it back from state in normal operation.
resource "azurerm_key_vault_secret" "postgres_admin_password" {
  name         = "postgres-admin-password"
  value        = random_password.postgres_admin.result
  key_vault_id = local.key_vault_id

  depends_on = [azurerm_private_endpoint.vault]
}

resource "azurerm_key_vault_secret" "database_url" {
  name = "DATABASE-URL"
  // The application connects as a restricted role created by the migration, not as this
  // admin. This entry exists so the migration job can run; the API uses its own.
  value = format(
    "postgres://%s:%s@%s:5432/%s?sslmode=require",
    var.postgres_admin_user,
    urlencode(random_password.postgres_admin.result),
    azurerm_postgresql_flexible_server.main.fqdn,
    azurerm_postgresql_flexible_server_database.app.name,
  )
  key_vault_id = local.key_vault_id

  depends_on = [azurerm_private_endpoint.vault]
}
