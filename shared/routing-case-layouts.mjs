// Each connection points from a declaration to a resource it actually references.
const az = "azurerm_";
const gc = "google_compute_";
const hub = {
  boxes: [
    ["frame","Azure · Virtual WAN 보안 허브",8,8,1132,354],
    [az+"virtual_network.azfw_vnet","워크로드 VNet",24,56,259,270],
    [az+"subnet.jump_subnet","Jump subnet",42,111,222,45],
    [az+"subnet.workload_subnet","Workload subnet",42,237,222,45],
    ["frame","Virtual WAN · 허브 연결 및 정책",335,56,788,270],
    [az+"virtual_hub_connection.azfw_vwan_hub_connection","VNet connection",351,111,184,45],
    [az+"virtual_hub.azfw_vwan_hub","Virtual hub",655,111,163,45],
    [az+"virtual_wan.azfw_vwan","Virtual WAN",927,111,174,45],
    [az+"virtual_hub_route_table.vhub_rt","Hub route table",351,237,184,45],
    [az+"firewall.fw","Azure Firewall",655,237,163,45],
    [az+"firewall_policy.azfw_policy","Firewall policy",927,237,174,45],
  ],
  links:[
    [az+"virtual_hub_connection.azfw_vwan_hub_connection",az+"virtual_network.azfw_vnet","remote VNet"],
    [az+"virtual_hub_connection.azfw_vwan_hub_connection",az+"virtual_hub.azfw_vwan_hub","hub"],
    [az+"virtual_hub.azfw_vwan_hub",az+"virtual_wan.azfw_vwan","WAN"],
    [az+"virtual_hub_route_table.vhub_rt",az+"firewall.fw","next hop"],
    [az+"firewall.fw",az+"virtual_hub.azfw_vwan_hub","virtual_hub"],
    [az+"firewall.fw",az+"firewall_policy.azfw_policy","policy"],
  ],
};
const regional = {
  boxes:[
    ["frame","GCP · 교차 리전 내부 HTTP 서비스",8,8,1150,372],
    ...["a","b"].flatMap((r,i)=>{
      const y=53+i*159;
      return [
        ["frame",i?"us-east1 · 프런트엔드":"us-west1 · 프런트엔드",24,y,230,142],
        [gc+"global_forwarding_rule.fwd_rule_"+r,"Internal VIP "+r.toUpperCase(),44,y+64,188,44],
        ["frame",i?"us-east1 · 백엔드":"us-west1 · 백엔드",900,y,238,142],
        [gc+"region_instance_group_manager.mig_"+r,"Backend MIG "+r.toUpperCase(),920,y+64,199,44],
      ];
    }),
    ["frame","리전 간 공유 로드 밸런서",295,53,562,301],
    [gc+"target_http_proxy.default","HTTP proxy",311,185,130,44],
    [gc+"url_map.default","URL map",514,185,113,44],
    [gc+"backend_service.default","Backend service",693,185,150,44],
  ],
  links:[
    ...["a","b"].map(r=>[gc+"global_forwarding_rule.fwd_rule_"+r,gc+"target_http_proxy.default","target"]),
    [gc+"target_http_proxy.default",gc+"url_map.default","url_map"],
    [gc+"url_map.default",gc+"backend_service.default","service"],
    ...["a","b"].map(r=>[gc+"backend_service.default",gc+"region_instance_group_manager.mig_"+r,"group"]),
  ],
};
const vpn = {
  boxes:[
    ["frame","GCP · VPC 간 HA VPN / us-central1",8,8,1140,390],
    ...[1,2].flatMap((n,i)=>{
      const x=i?602:24;
      return [
        [gc+"network.network"+n,"VPC "+n,x,55,522,320],
        [gc+"ha_vpn_gateway.ha_gateway"+n,"HA gateway "+n,x+152,99,210,44],
        ...[0,1].flatMap(k=>[
          [gc+"vpn_tunnel.tunnel"+(i*2+k+1),"IF "+k+" · Tunnel "+(i*2+k+1),x+18+k*275,216,203,44],
          [gc+"router_interface.router"+n+"_interface"+(k+1),"Router interface "+(k+1),x+18+k*275,306,203,42],
        ]),
      ];
    }),
  ],
  links:[
    ...[1,2].flatMap((n,i)=>[0,1].flatMap(k=>[
      [gc+"router_interface.router"+n+"_interface"+(k+1),gc+"vpn_tunnel.tunnel"+(i*2+k+1),"vpn_tunnel"],
      [gc+"vpn_tunnel.tunnel"+(i*2+k+1),gc+"ha_vpn_gateway.ha_gateway"+n,"gateway"],
    ])),
    [gc+"vpn_tunnel.tunnel1",gc+"ha_vpn_gateway.ha_gateway2","peer gateway"],
  ],
};
export const routingCases = {
  "azure-quickstart-201-azfw-with-secure-hub":hub,
  "gcp-lb-cross-reg-int-app-lb-mig-backend":regional,
  "gcp-vpn-ha-vpn-gateway-gcp-to-gcp":vpn,
};
