data "azurerm_client_config" "current" {}

# The control plane is owned by its own stack. This reads its outputs rather than
# redeclaring the vault, workspace or network, so there is exactly one definition of each.
data "terraform_remote_state" "control" {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-rootpanther-tfstate"
    storage_account_name = "strootpantherstate"
    container_name       = "tfstate"
    key                  = "stage1-control.tfstate"
    use_azuread_auth     = true
  }
}

locals {
  control_rg   = "rg-rootpanther-control"
  control_vnet = "vnet-rootpanther-control"
  key_vault_id = data.terraform_remote_state.control.outputs.key_vault_id
  workspace_id = data.terraform_remote_state.control.outputs.log_analytics_workspace_id
  vnet_id      = data.terraform_remote_state.control.outputs.vnet_id
}
