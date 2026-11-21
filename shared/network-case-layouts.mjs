import {routingCases} from "./routing-case-layouts.mjs";
import {serviceCases} from "./service-case-layouts.mjs";
// Representative Terraform references. Frames group resources without creating dependencies.
const gcp = "google_compute_";
const azure = "azurerm_";
const vpn = {
  boxes: [
    ["frame", "GCP · Interconnect / HA VPN · 8개 터널 중 두 경로", 8, 8, 1090, 335],
    ["frame", "온프레미스 · 외부 피어", 24, 56, 205, 260],
    [gcp+"network.network_havpn_ic", "Google Cloud VPC", 250, 56, 830, 260],
    ...[1, 2].flatMap((peer, i) => {
      const y = 123 + i * 121;
      const tunnel = i === 0 ? 1 : 4;
      return [
        [gcp+"external_vpn_gateway.external_vpngw_"+peer, "Peer gateway "+peer, 40, y, 169, 44],
        [gcp+"vpn_tunnel.tunnel_"+tunnel, "Tunnel "+tunnel, 300, y, 156, 44],
        [gcp+"ha_vpn_gateway.vpngw_"+peer, "HA gateway "+peer, 562, y, 168, 44],
        [gcp+"interconnect_attachment.ia_"+peer, "VLAN attachment "+peer, 848, y, 200, 44],
      ];
    }),
  ],
  links: [1, 2].flatMap((peer, i) => {
    const tunnel = gcp+"vpn_tunnel.tunnel_"+(i === 0 ? 1 : 4);
    const gateway = gcp+"ha_vpn_gateway.vpngw_"+peer;
    return [
      [tunnel, gcp+"external_vpn_gateway.external_vpngw_"+peer, "peer IF "+i],
      [tunnel, gateway, "interface "+i],
      [gateway, gcp+"interconnect_attachment.ia_"+peer, "interface "+i],
    ];
  }),
};
const endpointPairs = [
  ["mlw_ple", "Workspace PE", "machine_learning_workspace.default", "ML workspace"],
  ["kv_ple", "Vault PE", "key_vault.default", "Key Vault"],
  ["cr_ple", "Registry PE", "container_registry.default", "Container Registry"],
  ["st_ple_blob", "Blob PE", "storage_account.default", "Storage · Blob"],
];
const ml = {
  boxes: [
    ["frame", "Azure ML · 격리된 학습 환경과 Private Link", 8, 8, 1170, 455],
    [azure+"virtual_network.hub", "Hub VNet", 24, 55, 220, 385],
    [azure+"subnet.azure_firewall", "AzureFirewallSubnet", 37, 103, 194, 115],
    [azure+"firewall.azure_firewall_instance", "Firewall", 49, 154, 170, 42],
    [azure+"virtual_network_peering.direction1", "Peering → spoke", 39, 296, 184, 44],
    [azure+"virtual_network.default", "Spoke VNet", 308, 55, 538, 385],
    [azure+"subnet.snet-training", "Training subnet", 322, 104, 214, 115],
    [azure+"machine_learning_compute_cluster.compute", "CPU cluster", 335, 153, 184, 44],
    [azure+"subnet.snet-workspace", "Workspace subnet", 598, 104, 234, 315],
    ["frame", "Azure 관리형 서비스", 932, 55, 226, 385],
    ...endpointPairs.flatMap(([endpoint, label, service, title], i) => [
      [azure+"private_endpoint."+endpoint, label, 613, 153+i*68, 201, 42],
      [azure+service, title, 945, 153+i*68, 199, 42],
    ]),
  ],
  links: [
    [azure+"virtual_network_peering.direction1", azure+"virtual_network.default", "remote VNet"],
    [azure+"machine_learning_compute_cluster.compute", azure+"private_endpoint.mlw_ple", "depends_on"],
    ...endpointPairs.map(([endpoint,, service]) => [azure+"private_endpoint."+endpoint, azure+service, "Private Link"]),
  ],
};
const hub = {
  boxes: [
    ["frame", "Azure · 중앙 허브와 두 스포크", 8, 8, 1160, 375],
    [azure+"virtual_network.hub-vnet", "Hub VNet", 446, 51, 280, 308],
    [azure+"subnet.hub-gateway-subnet", "GatewaySubnet", 460, 92, 251, 109],
    [azure+"virtual_network_gateway.hub-vnet-gateway", "VPN gateway", 475, 142, 221, 42],
    [azure+"subnet.hub-dmz", "DMZ subnet", 460, 222, 251, 111],
    [azure+"network_interface.hub-nva-nic", "NVA interface", 475, 271, 221, 42],
    ...[1, 2].flatMap((n, i) => {
      const x = i === 0 ? 24 : 872;
      return [
        [azure+"virtual_network.spoke"+n+"-vnet", "Spoke "+n+" VNet", x, 51, 279, 308],
        [azure+"subnet.spoke"+n+"-mgmt", "Management subnet", x+13, 92, 251, 105],
        [azure+"network_interface.spoke"+n+"-nic", "Management NIC", x+26, 139, 224, 43],
        [azure+"virtual_network_peering.spoke"+n+"-hub-peer", "Peering → hub", x+13, 211, 251, 43],
        [azure+"subnet.spoke"+n+"-workload", "Workload subnet", x+13, 277, 251, 49],
      ];
    }),
  ],
  links: [1, 2].map(n => [azure+"virtual_network_peering.spoke"+n+"-hub-peer", azure+"virtual_network.hub-vnet", "remote VNet"]),
};
export const networkCases = {
  ...serviceCases,
  ...routingCases,
  "gcp-network-connectivity-interconnect-ha-vpn-over-interconnect-10gb-attach": vpn,
  "azure-quickstart-301-machine-learning-hub-spoke-secure": ml,
  "azure-quickstart-301-hub-spoke": hub,
};
