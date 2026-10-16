output "api_fqdn" {
  value       = azurerm_container_app.api.ingress[0].fqdn
  description = "Point api.rootpanther.com at this with a CNAME."
}

output "api_principal_id" {
  value       = azurerm_container_app.api.identity[0].principal_id
  description = "Managed identity the API authenticates with. Grant it, do not issue keys."
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_database" {
  value = azurerm_postgresql_flexible_server_database.app.name
}

output "storage_account_name" {
  value = azurerm_storage_account.artifacts.name
}

output "container_app_environment_id" {
  value = azurerm_container_app_environment.main.id
}
