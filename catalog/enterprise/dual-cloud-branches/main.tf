terraform {
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}
variable "gcp_project" { type = string }
variable "branch_public_ips" {
  type = tuple([string, string])
  description = "Public IPv4 addresses of the two existing on-premises BGP routers, AS 65010."
}
variable "google_tunnel_secrets" {
  type = tuple([string, string])
  sensitive = true
}
provider "aws" { region = "ap-northeast-2" }
provider "google" {
  project = var.gcp_project
  region  = "asia-northeast3"
}
resource "aws_vpc" "services" { cidr_block = "10.80.0.0/16" }
resource "aws_subnet" "apps" {
  vpc_id = aws_vpc.services.id
  cidr_block = "10.80.1.0/24"
}
resource "aws_vpn_gateway" "services" {
  vpc_id = aws_vpc.services.id
  amazon_side_asn = 64520
}
resource "aws_vpn_gateway_route_propagation" "apps" {
  vpn_gateway_id = aws_vpn_gateway.services.id
  route_table_id = aws_vpc.services.main_route_table_id
}
resource "google_compute_network" "data" {
  name = "branch-data"
  auto_create_subnetworks = false
  routing_mode = "GLOBAL"
}
resource "google_compute_subnetwork" "analytics" {
  name = "analytics"
  ip_cidr_range = "10.90.1.0/24"
  network = google_compute_network.data.id
}
resource "google_compute_router" "border" {
  name = "branch-border"
  network = google_compute_network.data.id
  bgp { asn = 64521 }
}
resource "google_compute_ha_vpn_gateway" "data" {
  name = "branch-ha"
  network = google_compute_network.data.id
}
resource "google_compute_external_vpn_gateway" "branch" {
  name = "branch-edge"
  redundancy_type = "TWO_IPS_REDUNDANCY"
  interface {
    id = 0
    ip_address = var.branch_public_ips[0]
  }
  interface {
    id = 1
    ip_address = var.branch_public_ips[1]
  }
}

resource "aws_customer_gateway" "east" {
  bgp_asn    = 65010
  ip_address = var.branch_public_ips[0]
  type       = "ipsec.1"
}
resource "aws_vpn_connection" "east" {
  customer_gateway_id = aws_customer_gateway.east.id
  vpn_gateway_id = aws_vpn_gateway.services.id
  type = "ipsec.1"
  static_routes_only = false
}
resource "google_compute_vpn_tunnel" "east" {
  name                            = "branch-east"
  vpn_gateway                     = google_compute_ha_vpn_gateway.data.id
  vpn_gateway_interface           = 0
  peer_external_gateway           = google_compute_external_vpn_gateway.branch.id
  peer_external_gateway_interface = 0
  router                          = google_compute_router.border.id
  shared_secret                   = var.google_tunnel_secrets[0]
  ike_version                     = 2
}
resource "google_compute_router_interface" "east" {
  name       = "branch-east"
  router     = google_compute_router.border.name
  ip_range   = "169.254.70.1/30"
  vpn_tunnel = google_compute_vpn_tunnel.east.id
}
resource "google_compute_router_peer" "east" {
  name            = "branch-east"
  router          = google_compute_router.border.name
  interface       = google_compute_router_interface.east.name
  peer_ip_address = "169.254.70.2"
  peer_asn        = 65010
}

resource "aws_customer_gateway" "west" {
  bgp_asn    = 65010
  ip_address = var.branch_public_ips[1]
  type       = "ipsec.1"
}
resource "aws_vpn_connection" "west" {
  customer_gateway_id = aws_customer_gateway.west.id
  vpn_gateway_id = aws_vpn_gateway.services.id
  type = "ipsec.1"
  static_routes_only = false
}
resource "google_compute_vpn_tunnel" "west" {
  name                            = "branch-west"
  vpn_gateway                     = google_compute_ha_vpn_gateway.data.id
  vpn_gateway_interface           = 1
  peer_external_gateway           = google_compute_external_vpn_gateway.branch.id
  peer_external_gateway_interface = 1
  router                          = google_compute_router.border.id
  shared_secret                   = var.google_tunnel_secrets[1]
  ike_version                     = 2
}
resource "google_compute_router_interface" "west" {
  name       = "branch-west"
  router     = google_compute_router.border.name
  ip_range   = "169.254.70.5/30"
  vpn_tunnel = google_compute_vpn_tunnel.west.id
}
resource "google_compute_router_peer" "west" {
  name            = "branch-west"
  router          = google_compute_router.border.name
  interface       = google_compute_router_interface.west.name
  peer_ip_address = "169.254.70.6"
  peer_asn        = 65010
}
