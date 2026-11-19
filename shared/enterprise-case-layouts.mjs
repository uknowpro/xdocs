// Each lane is an ownership or failure boundary. Only resource boxes select declarations.
function lanes(title, sections, links) {
  const rows = Math.max(...sections.map((section) => section.items.length));
  const height = 150 + rows * 68;
  const boxes = [["frame", title, 8, 8, 1136, height]];
  sections.forEach(({ label, items, scope }, i) => {
    const left = 24 + 373 * i;
    boxes.push(["frame", label, left, 52, 350, height - 65]);
    if (scope)
      boxes.push([
        scope[0],
        scope[1],
        left + 12,
        90,
        326,
        (scope[2] || items.length) * 68 + 48,
      ]);
    items.forEach(([key, caption], j) =>
      boxes.push([
        key,
        caption,
        left + 42,
        (scope ? 136 : 100) + j * 68,
        264,
        42,
      ]),
    );
  });
  return { boxes, links };
}
export const enterpriseCases = {
  "organization-audit": lanes(
    "AWS Organizations · Seoul",
    [
      {
        label: "Workload account",
        scope: ["aws_vpc.application", "Application VPC · 10.72.0.0/16"],
        items: [
          ["aws_subnet.zone_a", "Private · AZ 2a"],
          ["aws_subnet.zone_c", "Private · AZ 2c"],
        ],
      },
      {
        label: "Management account",
        items: [
          ["data.aws_organizations_organization.org", "Organization"],
          ["data.aws_caller_identity.management", "Management identity"],
          ["aws_cloudtrail.organization", "Multi-region organization trail"],
        ],
      },
      {
        label: "Log archive account",
        items: [
          ["aws_s3_bucket_policy.delivery", "Delivery policy"],
          ["aws_s3_bucket_public_access_block.private", "Public access block"],
          ["aws_s3_bucket.audit", "Audit archive"],
          ["aws_s3_bucket_versioning.retention", "Object versioning"],
        ],
      },
    ],
    [
      ["aws_cloudtrail.organization", "aws_s3_bucket.audit", "log delivery"],
      [
        "aws_cloudtrail.organization",
        "aws_s3_bucket_policy.delivery",
        "depends_on",
      ],
    ],
  ),
  "regional-app-dr": lanes(
    "Azure · Stateless application failover",
    [
      {
        label: "Korea Central · primary",
        items: [
          ["azurerm_resource_group.primary", "Primary resource group"],
          ["azurerm_service_plan.primary", "Linux App Service plan"],
          ["azurerm_linux_web_app.primary", "Primary web app"],
        ],
      },
      {
        label: "Global DNS · priority routing",
        items: [
          ["azurerm_traffic_manager_profile.public", "Traffic Manager"],
          ["azurerm_traffic_manager_azure_endpoint.primary", "Priority 1"],
          ["azurerm_traffic_manager_azure_endpoint.recovery", "Priority 2"],
        ],
      },
      {
        label: "Japan East · warm standby",
        items: [
          ["azurerm_resource_group.recovery", "Recovery resource group"],
          ["azurerm_service_plan.recovery", "Linux App Service plan"],
          ["azurerm_linux_web_app.recovery", "Standby web app"],
        ],
      },
    ],
    [
      [
        "azurerm_traffic_manager_azure_endpoint.primary",
        "azurerm_linux_web_app.primary",
        "HTTPS probe",
      ],
      [
        "azurerm_traffic_manager_azure_endpoint.recovery",
        "azurerm_linux_web_app.recovery",
        "HTTPS probe",
      ],
    ],
  ),
  "dual-cloud-branches": lanes(
    "Branch office · independent AWS and GCP paths",
    [
      {
        label: "AWS · Seoul",
        scope: ["aws_vpc.services", "Services VPC · 10.80.0.0/16", 1],
        items: [
          ["aws_subnet.apps", "Application subnet"],
          ["aws_vpn_gateway.services", "Virtual private gateway"],
          ["aws_vpn_connection.east", "East VPN connection"],
          ["aws_vpn_connection.west", "West VPN connection"],
          ["aws_vpn_gateway_route_propagation.apps", "Main table propagation"],
        ],
      },
      {
        label: "On-premises peer definitions · AS 65010",
        items: [
          ["aws_customer_gateway.east", "East router · AWS peer"],
          ["aws_customer_gateway.west", "West router · AWS peer"],
          [
            "google_compute_external_vpn_gateway.branch",
            "Same router pair · GCP peers",
          ],
        ],
      },
      {
        label: "GCP · Seoul",
        scope: [
          "google_compute_network.data",
          "Analytics VPC · global routing",
          1,
        ],
        items: [
          ["google_compute_subnetwork.analytics", "Analytics subnet"],
          ["google_compute_router.border", "Cloud Router"],
          ["google_compute_vpn_tunnel.east", "East IPsec tunnel"],
          ["google_compute_vpn_tunnel.west", "West IPsec tunnel"],
          ["google_compute_router_peer.east", "East BGP session"],
          ["google_compute_router_peer.west", "West BGP session"],
        ],
      },
    ],
    [
      ["aws_vpn_connection.east", "aws_customer_gateway.east", "IPsec"],
      ["aws_vpn_connection.west", "aws_customer_gateway.west", "IPsec"],
      [
        "google_compute_external_vpn_gateway.branch",
        "google_compute_vpn_tunnel.east",
        "interface 0",
      ],
      [
        "google_compute_external_vpn_gateway.branch",
        "google_compute_vpn_tunnel.west",
        "interface 1",
      ],
    ],
  ),
};
