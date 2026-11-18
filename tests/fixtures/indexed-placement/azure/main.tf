terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "4.81.0" }
  }
}
provider "azurerm" {
  features {}
}
variable "admin_password" {
  type      = string
  sensitive = true
}
locals { prefixes = { blue = "10.0.1.0/24", green = "10.0.2.0/24" } }
resource "azurerm_resource_group" "main" {
  name     = "sample"
  location = "eastus"
}
resource "azurerm_virtual_network" "main" {
  name                = "sample"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.0.0.0/16"]
}
resource "azurerm_subnet" "app" {
  for_each             = local.prefixes
  name                 = each.key
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [each.value]
}
resource "azurerm_subnet" "fixed" {
  name                 = "fixed"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.3.0/24"]
}
resource "azurerm_network_interface" "per_key" {
  for_each            = local.prefixes
  name                = each.key
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  ip_configuration {
    name                          = "primary"
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.app[each.key].id
  }
}
resource "azurerm_network_interface" "fixed" {
  name                = "fixed"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  ip_configuration {
    name                          = "primary"
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.fixed.id
  }
}
resource "azurerm_linux_virtual_machine" "app" {
  name                            = "app"
  location                        = azurerm_resource_group.main.location
  resource_group_name             = azurerm_resource_group.main.name
  size                            = "Standard_B2s"
  admin_username                  = "sampleadmin"
  admin_password                  = var.admin_password
  disable_password_authentication = false
  network_interface_ids           = [azurerm_network_interface.fixed.id]
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}
