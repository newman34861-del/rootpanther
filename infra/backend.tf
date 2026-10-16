terraform {
  backend "azurerm" {
    resource_group_name  = "rg-rootpanther-tfstate"
    storage_account_name = "strootpantherstate"
    container_name       = "tfstate"
    key                  = "stage4-api.tfstate"
    use_azuread_auth     = true
  }
}
