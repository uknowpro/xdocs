// Each arrow resolves to a reference in the shipped Terraform declaration.
const az = "azurerm_";
const gc = "google_compute_";
const avd = {
  boxes: [
    ["frame", "Azure Virtual Desktop · 세션 호스트와 CIFS 프로필 저장소", 8, 8, 1120, 380],
    [az+"virtual_network.vnet", "AVD VNet", 28, 54, 1080, 250],
    [az+"subnet.subnet", "세션 호스트 서브넷", 48, 95, 475, 182],
    [az+"windows_virtual_machine.avd_vm", "Session host", 65, 171, 175, 46],
    [az+"network_interface.avd_vm_nic", "Host NIC", 332, 171, 170, 46],
    ["frame", "Azure NetApp Files · CIFS", 562, 95, 522, 182],
    [az+"netapp_volume.NetApp_Vol", "Profile volume · 100 GiB", 580, 171, 197, 46],
    [az+"subnet.netapp_subnet", "NetApp 전용 서브넷", 864, 171, 201, 46],
    ["step:profile", "프로필 사용 경로   세션 호스트 → SMB 공유   ·   FSLogix 마운트는 별도 설정", 48, 322, 1036, 44],
  ],
  links: [
    [az+"windows_virtual_machine.avd_vm", az+"network_interface.avd_vm_nic", "NIC"],
    [az+"netapp_volume.NetApp_Vol", az+"subnet.netapp_subnet", "subnet_id"],
  ],
};
const sharedVpc = {
  boxes: [
    ["frame","GCP · Shared VPC / 교차 프로젝트 HTTPS",8,8,1140,390],
    ["frame","호스트 프로젝트 · 공유 네트워크",24,49,1108,109],
    [gc+"network.lb_network","Shared VPC",52,94,200,44],
    [gc+"subnetwork.lb_frontend_and_backend_subnet","Frontend / backend subnet",365,94,260,44],
    [gc+"subnetwork.proxy_only_subnet","Proxy-only subnet",835,94,258,44],
    ["frame","서비스 프로젝트 A · 프런트엔드",24,182,562,186],
    [gc+"forwarding_rule.default","HTTPS VIP",42,252,132,46],
    [gc+"region_target_https_proxy.default","HTTPS proxy",240,252,134,46],
    [gc+"region_url_map.default","URL map",449,252,119,46],
    ["frame","서비스 프로젝트 B · 백엔드",652,182,480,186],
    [gc+"region_backend_service.default","Backend service",671,252,181,46],
    [gc+"instance_group_manager.default","Managed instance group",930,252,185,46],
  ],
  links: [
    [gc+"subnetwork.lb_frontend_and_backend_subnet",gc+"network.lb_network","network"],
    [gc+"forwarding_rule.default",gc+"region_target_https_proxy.default","target"],
    [gc+"region_target_https_proxy.default",gc+"region_url_map.default","url_map"],
    [gc+"region_url_map.default",gc+"region_backend_service.default","default_service"],
    [gc+"region_backend_service.default",gc+"instance_group_manager.default","group"],
  ],
};
const synapse = {
  boxes: [
    ["frame","Azure Synapse · Private Link와 기본 데이터 레이크",8,8,1130,370],
    [az+"virtual_network.default","클라이언트 VNet",26,51,365,300],
    [az+"subnet.default","사설 엔드포인트 서브넷",43,92,331,239],
    [az+"private_endpoint.pe_dev","Synapse Dev PE",85,142,236,44],
    [az+"private_endpoint.pe_dfs","Storage DFS PE",85,248,236,44],
    ["frame","관리형 분석 서비스",463,51,651,300],
    [az+"synapse_workspace.default","Synapse workspace",482,142,201,44],
    [az+"storage_data_lake_gen2_filesystem.default","ADLS Gen2 filesystem",865,142,223,44],
    [az+"storage_account.default","Storage account",865,248,223,44],
  ],
  links: [
    [az+"private_endpoint.pe_dev",az+"synapse_workspace.default","Dev"],
    [az+"private_endpoint.pe_dfs",az+"storage_account.default","DFS"],
    [az+"synapse_workspace.default",az+"storage_data_lake_gen2_filesystem.default","default filesystem"],
    [az+"storage_data_lake_gen2_filesystem.default",az+"storage_account.default","storage_account_id"],
  ],
};
const mirror = {
  boxes: [
    ["frame","GCP · 패킷 미러링 / TCP · ingress + egress",8,8,1140,340],
    [gc+"network.ilb_network","VPC · europe-west1",25,52,1106,265],
    [gc+"subnetwork.ilb_subnet","워크로드 서브넷 · 원본 TCP 송수신",45,115,235,150],
    [gc+"instance.vm_test","Source VM",62,180,202,44],
    [gc+"packet_mirroring.default","Mirroring policy · BOTH",366,180,191,44],
    ["frame","복제 트래픽 수집 · internal load balancer",634,115,477,150],
    [gc+"forwarding_rule.default","Collector ILB",648,180,119,44],
    [gc+"region_backend_service.default","Backend",826,180,104,44],
    [gc+"region_instance_group_manager.mig","Collector MIG",980,180,117,44],
  ],
  links: [
    [gc+"packet_mirroring.default",gc+"instance.vm_test","mirrored source"],
    [gc+"packet_mirroring.default",gc+"forwarding_rule.default","collector_ilb"],
    [gc+"forwarding_rule.default",gc+"region_backend_service.default","backend"],
    [gc+"region_backend_service.default",gc+"region_instance_group_manager.mig","group"],
  ],
};
export const serviceCases = {
  "azure-quickstart-101-azure-virtual-desktop-anf": avd,
  "azure-quickstart-201-synapse-secure": synapse,
  "gcp-lb-shared-vpc-https-ilb-with-mig-backend-cross-reference-example": sharedVpc,
  "gcp-compute-packet-mirroring-full": mirror,
};
