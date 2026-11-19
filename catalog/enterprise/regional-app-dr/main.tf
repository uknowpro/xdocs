terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}
provider "azurerm" {
  features {}
}
variable "name_prefix" {
  type = string
  description = "Globally unique lowercase prefix for web app and DNS names."
}
resource "azurerm_resource_group" "primary" {
  name = "${var.name_prefix}-primary"
  location = "koreacentral"
}
resource "azurerm_resource_group" "recovery" {
  name = "${var.name_prefix}-recovery"
  location = "japaneast"
}
resource "azurerm_traffic_manager_profile" "public" {
  name = "${var.name_prefix}-global"
  resource_group_name = azurerm_resource_group.primary.name
  traffic_routing_method = "Priority"
  dns_config {
    relative_name = var.name_prefix
    ttl = 30
  }
  monitor_config {
    protocol = "HTTPS"
    port = 443
    path = "/health"
    interval_in_seconds = 30
    timeout_in_seconds = 10
    tolerated_number_of_failures = 3
  }
}

resource "azurerm_service_plan" "primary" {
  name                = "${var.name_prefix}-primary"
  resource_group_name = azurerm_resource_group.primary.name
  location            = azurerm_resource_group.primary.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}
resource "azurerm_linux_web_app" "primary" {
  name                = "${var.name_prefix}-primary"
  resource_group_name = azurerm_resource_group.primary.name
  location            = azurerm_resource_group.primary.location
  service_plan_id     = azurerm_service_plan.primary.id
  https_only          = true
  site_config { always_on = true }
}
resource "azurerm_traffic_manager_azure_endpoint" "primary" {
  name               = "primary"
  profile_id         = azurerm_traffic_manager_profile.public.id
  target_resource_id = azurerm_linux_web_app.primary.id
  priority           = 1
  weight             = 1
}

resource "azurerm_service_plan" "recovery" {
  name                = "${var.name_prefix}-recovery"
  resource_group_name = azurerm_resource_group.recovery.name
  location            = azurerm_resource_group.recovery.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}
resource "azurerm_linux_web_app" "recovery" {
  name                = "${var.name_prefix}-recovery"
  resource_group_name = azurerm_resource_group.recovery.name
  location            = azurerm_resource_group.recovery.location
  service_plan_id     = azurerm_service_plan.recovery.id
  https_only          = true
  site_config { always_on = true }
}
resource "azurerm_traffic_manager_azure_endpoint" "recovery" {
  name               = "recovery"
  profile_id         = azurerm_traffic_manager_profile.public.id
  target_resource_id = azurerm_linux_web_app.recovery.id
  priority           = 2
  weight             = 1
}
