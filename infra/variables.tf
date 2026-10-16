variable "subscription_id" {
  type        = string
  description = "Platform subscription id, supplied as TF_VAR_subscription_id. Never committed."
}

variable "location" {
  type    = string
  default = "westeurope"
}

# Subnets are carved from the control VNet (10.80.0.0/16). 10.80.0.0/24 is already
# snet-management and 10.80.1.0/24 was reserved for private endpoints by stage 1.
variable "privatelink_subnet_cidr" {
  type    = string
  default = "10.80.1.0/24"
}

variable "postgres_subnet_cidr" {
  type        = string
  description = "Delegated to the PostgreSQL flexible server. Cannot host anything else."
  default     = "10.80.2.0/24"
}

variable "apps_subnet_cidr" {
  type        = string
  description = "Container Apps infrastructure subnet. A /23 is the documented minimum."
  default     = "10.80.4.0/23"
}

variable "postgres_sku" {
  type        = string
  description = "Burstable is the right shape here: load is bursty and small until there are paying learners."
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_admin_user" {
  type    = string
  default = "rpadmin"
}

variable "api_image" {
  type        = string
  description = "Container image for the API. Set once a registry exists."
  default     = "mcr.microsoft.com/k8se/quickstart:latest"
}

variable "tags" {
  type = map(string)
  default = {
    platform = "rootpanther"
    plane    = "control"
    stage    = "4-api"
  }
}
