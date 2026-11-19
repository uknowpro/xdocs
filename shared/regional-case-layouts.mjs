export const regionalCases = {
  "azure-isolated-spokes": {
    "boxes": [
      [
        "frame",
        "Azure · Korea Central",
        8,
        8,
        980,
        460
      ],
      [
        "azurerm_resource_group.hub",
        "hub · resource group",
        24,
        55,
        300,
        360
      ],
      [
        "azurerm_virtual_network.hub",
        "VNet · 10.80.0.0/16",
        36,
        102,
        276,
        250
      ],
      [
        "azurerm_subnet.hub",
        "Private subnet",
        48,
        159,
        252,
        48
      ],
      [
        "azurerm_resource_group.orders",
        "orders · resource group",
        344,
        55,
        300,
        360
      ],
      [
        "azurerm_virtual_network.orders",
        "VNet · 10.81.0.0/16",
        356,
        102,
        276,
        250
      ],
      [
        "azurerm_subnet.orders",
        "Private subnet",
        368,
        159,
        252,
        48
      ],
      [
        "azurerm_virtual_network_peering.orders_to_hub",
        "orders → hub",
        368,
        225,
        245,
        38
      ],
      [
        "azurerm_virtual_network_peering.hub_to_orders",
        "hub → orders",
        48,
        225,
        245,
        38
      ],
      [
        "azurerm_resource_group.finance",
        "finance · resource group",
        664,
        55,
        300,
        360
      ],
      [
        "azurerm_virtual_network.finance",
        "VNet · 10.82.0.0/16",
        676,
        102,
        276,
        250
      ],
      [
        "azurerm_subnet.finance",
        "Private subnet",
        688,
        159,
        252,
        48
      ],
      [
        "azurerm_virtual_network_peering.finance_to_hub",
        "finance → hub",
        688,
        225,
        245,
        38
      ],
      [
        "azurerm_virtual_network_peering.hub_to_finance",
        "hub → finance",
        48,
        273,
        245,
        38
      ]
    ],
    "links": [
      [
        "azurerm_virtual_network_peering.orders_to_hub",
        "azurerm_virtual_network.hub",
        "remote VNet"
      ],
      [
        "azurerm_virtual_network_peering.hub_to_orders",
        "azurerm_virtual_network.orders",
        "remote VNet"
      ],
      [
        "azurerm_virtual_network_peering.finance_to_hub",
        "azurerm_virtual_network.hub",
        "remote VNet"
      ],
      [
        "azurerm_virtual_network_peering.hub_to_finance",
        "azurerm_virtual_network.finance",
        "remote VNet"
      ]
    ]
  },
  "gcp-regional-shared-egress": {
    "boxes": [
      [
        "frame",
        "GCP · Shared VPC",
        8,
        8,
        980,
        470
      ],
      [
        "google_compute_shared_vpc_host_project.host",
        "Host project",
        25,
        55,
        710,
        384
      ],
      [
        "google_compute_network.fabric",
        "Global VPC",
        40,
        102,
        680,
        320
      ],
      [
        "google_compute_shared_vpc_service_project.orders",
        "Orders · service project",
        754,
        155,
        220,
        54
      ],
      [
        "frame",
        "asia-northeast3",
        55,
        150,
        320,
        250
      ],
      [
        "google_compute_subnetwork.seoul",
        "Private workloads",
        65,
        191,
        300,
        45
      ],
      [
        "google_compute_router.seoul",
        "Cloud Router",
        65,
        258,
        300,
        45
      ],
      [
        "google_compute_router_nat.seoul",
        "Regional NAT",
        65,
        337,
        300,
        42
      ],
      [
        "frame",
        "asia-northeast1",
        385,
        150,
        320,
        250
      ],
      [
        "google_compute_subnetwork.tokyo",
        "Private workloads",
        395,
        191,
        300,
        45
      ],
      [
        "google_compute_router.tokyo",
        "Cloud Router",
        395,
        258,
        300,
        45
      ],
      [
        "google_compute_router_nat.tokyo",
        "Regional NAT",
        395,
        337,
        300,
        42
      ]
    ],
    "links": [
      [
        "google_compute_router_nat.seoul",
        "google_compute_router.seoul",
        "router"
      ],
      [
        "google_compute_router_nat.tokyo",
        "google_compute_router.tokyo",
        "router"
      ]
    ]
  }
};
