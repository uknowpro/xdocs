export const firewallCase =
  "azure-quickstart-301-nat-gateway-hub-spoke-firewall";
export const firewallSteps = [
  ["azurerm_virtual_network.spoke", "스포크 · subnet-private"],
  ["azurerm_subnet_route_table_association.spoke", "서브넷에 UDR 연결"],
  ["azurerm_route_table.spoke", "기본 경로 · 방화벽 사설 IP"],
  ["azurerm_firewall.main", "허브 방화벽"],
  ["azurerm_firewall_policy.main", "방화벽 정책"],
  [
    "azurerm_firewall_policy_rule_collection_group.main",
    "TCP 80·443 허용 규칙",
  ],
];
export const firewallDiagram = {
  boxes: [
    ["frame", "Azure · Spoke outbound web traffic", 8, 8, 990, 430],
    ["frame", "Spoke VNet · 10.1.0.0/16", 24, 54, 452, 354],
    ["frame", "Hub · inspection", 508, 54, 466, 354],
    ...firewallSteps.map(([id, label], i) => [
      id,
      label,
      i < 3 ? 68 : 552,
      100 + (i < 3 ? i : 5 - i) * 100,
      350,
      48,
    ]),
  ],
  links: [
    [firewallSteps[0][0], firewallSteps[1][0], "subnet-private"],
    [firewallSteps[1][0], firewallSteps[2][0], "route_table_id"],
    [firewallSteps[2][0], firewallSteps[3][0], "next hop"],
    [firewallSteps[3][0], firewallSteps[4][0], "policy"],
    [firewallSteps[4][0], firewallSteps[5][0], "rule group"],
  ],
};
