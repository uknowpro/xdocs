terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "7.46.2" }
  }
}
provider "google" {
  project = "xdocs-example"
  region  = "asia-northeast3"
}
locals { ranges = { blue = "10.2.1.0/24", green = "10.2.2.0/24" } }
resource "google_compute_network" "app" {
  name                    = "app"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "app" {
  name          = "app"
  region        = "asia-northeast3"
  ip_cidr_range = "10.0.0.0/24"
  network       = google_compute_network.app.id
}
resource "google_compute_network" "ops" {
  name                    = "ops"
  auto_create_subnetworks = false
}
resource "google_compute_subnetwork" "ops" {
  name          = "ops"
  region        = "asia-northeast3"
  ip_cidr_range = "10.1.0.0/24"
  network       = google_compute_network.ops.id
}
resource "google_compute_subnetwork" "per_key" {
  for_each      = local.ranges
  name          = each.key
  region        = "asia-northeast3"
  ip_cidr_range = each.value
  network       = google_compute_network.app.id
}
resource "google_compute_instance" "fixed" {
  name         = "fixed"
  machine_type = "e2-medium"
  zone         = "asia-northeast3-a"
  boot_disk {
    initialize_params { image = "debian-cloud/debian-12" }
  }
  network_interface { subnetwork = google_compute_subnetwork.app.self_link }
}
resource "google_compute_instance" "per_key" {
  for_each     = local.ranges
  name         = each.key
  machine_type = "e2-medium"
  zone         = "asia-northeast3-a"
  boot_disk {
    initialize_params { image = "debian-cloud/debian-12" }
  }
  network_interface { subnetwork = google_compute_subnetwork.per_key[each.key].self_link }
}
resource "google_compute_instance" "multi" {
  name         = "multi"
  machine_type = "e2-medium"
  zone         = "asia-northeast3-a"
  boot_disk {
    initialize_params { image = "debian-cloud/debian-12" }
  }
  network_interface { subnetwork = google_compute_subnetwork.app.self_link }
  network_interface { subnetwork = google_compute_subnetwork.ops.self_link }
}
