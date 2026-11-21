// Managed resource names grouped by service from registry.terraform.io/v1/providers/{provider}/{version}.
export const providerCatalog = {
  "AWS": {
    "provider": "hashicorp/aws",
    "version": "6.73.0",
    "services": {
      "IAM Access Analyzer": [
        "aws_accessanalyzer_analyzer",
        "aws_accessanalyzer_archive_rule"
      ],
      "Account Access": [
        "aws_accountaccess_application",
        "aws_accountaccess_entitlement"
      ],
      "Account Management": [
        "aws_account_alternate_contact",
        "aws_account_primary_contact",
        "aws_account_region"
      ],
      "ACM (Certificate Manager)": [
        "aws_acm_certificate",
        "aws_acm_certificate_validation"
      ],
      "ACM PCA (Certificate Manager Private Certificate Authority)": [
        "aws_acmpca_certificate",
        "aws_acmpca_certificate_authority",
        "aws_acmpca_certificate_authority_certificate",
        "aws_acmpca_permission",
        "aws_acmpca_policy"
      ],
      "Agent Registry": [
        "aws_agentregistry_registry"
      ],
      "EC2 (Elastic Compute Cloud)": [
        "aws_ami",
        "aws_ami_copy",
        "aws_ami_from_instance",
        "aws_ami_launch_permission",
        "aws_ec2_allowed_images_settings",
        "aws_ec2_availability_zone_group",
        "aws_ec2_capacity_block_reservation",
        "aws_ec2_capacity_manager",
        "aws_ec2_capacity_reservation",
        "aws_ec2_default_credit_specification",
        "aws_ec2_fleet",
        "aws_ec2_host",
        "aws_ec2_image_block_public_access",
        "aws_ec2_instance_connect_endpoint",
        "aws_ec2_instance_metadata_defaults",
        "aws_ec2_instance_state",
        "aws_ec2_secondary_network",
        "aws_ec2_secondary_subnet",
        "aws_ec2_serial_console_access",
        "aws_ec2_tag",
        "aws_eip",
        "aws_eip_association",
        "aws_eip_domain_name",
        "aws_instance",
        "aws_key_pair",
        "aws_launch_template",
        "aws_placement_group",
        "aws_spot_datafeed_subscription",
        "aws_spot_fleet_request",
        "aws_spot_instance_request"
      ],
      "Amplify": [
        "aws_amplify_app",
        "aws_amplify_backend_environment",
        "aws_amplify_branch",
        "aws_amplify_domain_association",
        "aws_amplify_webhook"
      ],
      "API Gateway": [
        "aws_api_gateway_account",
        "aws_api_gateway_api_key",
        "aws_api_gateway_authorizer",
        "aws_api_gateway_base_path_mapping",
        "aws_api_gateway_client_certificate",
        "aws_api_gateway_deployment",
        "aws_api_gateway_documentation_part",
        "aws_api_gateway_documentation_version",
        "aws_api_gateway_domain_name",
        "aws_api_gateway_domain_name_access_association",
        "aws_api_gateway_gateway_response",
        "aws_api_gateway_integration",
        "aws_api_gateway_integration_response",
        "aws_api_gateway_method",
        "aws_api_gateway_method_response",
        "aws_api_gateway_method_settings",
        "aws_api_gateway_model",
        "aws_api_gateway_request_validator",
        "aws_api_gateway_resource",
        "aws_api_gateway_rest_api",
        "aws_api_gateway_rest_api_policy",
        "aws_api_gateway_rest_api_put",
        "aws_api_gateway_stage",
        "aws_api_gateway_usage_plan",
        "aws_api_gateway_usage_plan_key",
        "aws_api_gateway_vpc_link"
      ],
      "API Gateway V2": [
        "aws_apigatewayv2_api",
        "aws_apigatewayv2_api_mapping",
        "aws_apigatewayv2_authorizer",
        "aws_apigatewayv2_deployment",
        "aws_apigatewayv2_domain_name",
        "aws_apigatewayv2_integration",
        "aws_apigatewayv2_integration_response",
        "aws_apigatewayv2_model",
        "aws_apigatewayv2_route",
        "aws_apigatewayv2_route_response",
        "aws_apigatewayv2_routing_rule",
        "aws_apigatewayv2_stage",
        "aws_apigatewayv2_vpc_link"
      ],
      "Application Auto Scaling": [
        "aws_appautoscaling_policy",
        "aws_appautoscaling_scheduled_action",
        "aws_appautoscaling_target"
      ],
      "AppConfig": [
        "aws_appconfig_application",
        "aws_appconfig_configuration_profile",
        "aws_appconfig_deployment",
        "aws_appconfig_deployment_strategy",
        "aws_appconfig_environment",
        "aws_appconfig_extension",
        "aws_appconfig_extension_association",
        "aws_appconfig_hosted_configuration_version"
      ],
      "ELB Classic": [
        "aws_app_cookie_stickiness_policy",
        "aws_elb",
        "aws_elb_attachment",
        "aws_lb_cookie_stickiness_policy",
        "aws_lb_ssl_negotiation_policy",
        "aws_load_balancer_backend_server_policy",
        "aws_load_balancer_listener_policy",
        "aws_load_balancer_policy",
        "aws_proxy_protocol_policy"
      ],
      "AppFabric": [
        "aws_appfabric_app_authorization",
        "aws_appfabric_app_authorization_connection",
        "aws_appfabric_app_bundle",
        "aws_appfabric_ingestion",
        "aws_appfabric_ingestion_destination"
      ],
      "AppFlow": [
        "aws_appflow_connector_profile",
        "aws_appflow_flow"
      ],
      "AppIntegrations": [
        "aws_appintegrations_data_integration",
        "aws_appintegrations_event_integration"
      ],
      "CloudWatch Application Insights": [
        "aws_applicationinsights_application"
      ],
      "App Mesh": [
        "aws_appmesh_gateway_route",
        "aws_appmesh_mesh",
        "aws_appmesh_route",
        "aws_appmesh_virtual_gateway",
        "aws_appmesh_virtual_node",
        "aws_appmesh_virtual_router",
        "aws_appmesh_virtual_service"
      ],
      "App Runner": [
        "aws_apprunner_auto_scaling_configuration_version",
        "aws_apprunner_connection",
        "aws_apprunner_custom_domain_association",
        "aws_apprunner_default_auto_scaling_configuration_version",
        "aws_apprunner_deployment",
        "aws_apprunner_observability_configuration",
        "aws_apprunner_service",
        "aws_apprunner_vpc_connector",
        "aws_apprunner_vpc_ingress_connection"
      ],
      "AppStream 2.0": [
        "aws_appstream_directory_config",
        "aws_appstream_fleet",
        "aws_appstream_fleet_stack_association",
        "aws_appstream_image_builder",
        "aws_appstream_stack",
        "aws_appstream_user",
        "aws_appstream_user_stack_association"
      ],
      "AppSync": [
        "aws_appsync_api",
        "aws_appsync_api_cache",
        "aws_appsync_api_key",
        "aws_appsync_channel_namespace",
        "aws_appsync_datasource",
        "aws_appsync_domain_name",
        "aws_appsync_domain_name_api_association",
        "aws_appsync_function",
        "aws_appsync_graphql_api",
        "aws_appsync_resolver",
        "aws_appsync_source_api_association",
        "aws_appsync_type"
      ],
      "ARC (Application Recovery Controller) Region Switch": [
        "aws_arcregionswitch_plan"
      ],
      "ARC (Application Recovery Controller) Zonal Shift": [
        "aws_arczonalshift_autoshift_observer_notification_status",
        "aws_arczonalshift_zonal_autoshift_configuration"
      ],
      "Athena": [
        "aws_athena_capacity_reservation",
        "aws_athena_database",
        "aws_athena_data_catalog",
        "aws_athena_named_query",
        "aws_athena_prepared_statement",
        "aws_athena_workgroup"
      ],
      "Audit Manager": [
        "aws_auditmanager_account_registration",
        "aws_auditmanager_assessment",
        "aws_auditmanager_assessment_delegation",
        "aws_auditmanager_assessment_report",
        "aws_auditmanager_control",
        "aws_auditmanager_framework",
        "aws_auditmanager_framework_share",
        "aws_auditmanager_organization_admin_account_registration"
      ],
      "Auto Scaling": [
        "aws_autoscaling_attachment",
        "aws_autoscaling_group",
        "aws_autoscaling_group_tag",
        "aws_autoscaling_lifecycle_hook",
        "aws_autoscaling_notification",
        "aws_autoscaling_policy",
        "aws_autoscaling_schedule",
        "aws_autoscaling_traffic_source_attachment",
        "aws_launch_configuration"
      ],
      "Auto Scaling Plans": [
        "aws_autoscalingplans_scaling_plan"
      ],
      "Backup": [
        "aws_backup_framework",
        "aws_backup_global_settings",
        "aws_backup_logically_air_gapped_vault",
        "aws_backup_plan",
        "aws_backup_region_settings",
        "aws_backup_report_plan",
        "aws_backup_restore_testing_plan",
        "aws_backup_restore_testing_selection",
        "aws_backup_selection",
        "aws_backup_vault",
        "aws_backup_vault_lock_configuration",
        "aws_backup_vault_notifications",
        "aws_backup_vault_policy"
      ],
      "Batch": [
        "aws_batch_compute_environment",
        "aws_batch_job_definition",
        "aws_batch_job_queue",
        "aws_batch_scheduling_policy"
      ],
      "BCM Data Exports": [
        "aws_bcmdataexports_export"
      ],
      "Bedrock Agents": [
        "aws_bedrockagent_agent",
        "aws_bedrockagent_agent_action_group",
        "aws_bedrockagent_agent_alias",
        "aws_bedrockagent_agent_collaborator",
        "aws_bedrockagent_agent_knowledge_base_association",
        "aws_bedrockagent_data_source",
        "aws_bedrockagent_flow",
        "aws_bedrockagent_knowledge_base",
        "aws_bedrockagent_prompt"
      ],
      "Bedrock AgentCore": [
        "aws_bedrockagentcore_agent_runtime",
        "aws_bedrockagentcore_agent_runtime_endpoint",
        "aws_bedrockagentcore_api_key_credential_provider",
        "aws_bedrockagentcore_browser",
        "aws_bedrockagentcore_browser_profile",
        "aws_bedrockagentcore_code_interpreter",
        "aws_bedrockagentcore_evaluator",
        "aws_bedrockagentcore_gateway",
        "aws_bedrockagentcore_gateway_rule",
        "aws_bedrockagentcore_gateway_target",
        "aws_bedrockagentcore_harness",
        "aws_bedrockagentcore_memory",
        "aws_bedrockagentcore_memory_strategy",
        "aws_bedrockagentcore_oauth2_credential_provider",
        "aws_bedrockagentcore_online_evaluation_config",
        "aws_bedrockagentcore_policy",
        "aws_bedrockagentcore_policy_engine",
        "aws_bedrockagentcore_registry",
        "aws_bedrockagentcore_resource_policy",
        "aws_bedrockagentcore_token_vault_cmk",
        "aws_bedrockagentcore_workload_identity"
      ],
      "Bedrock": [
        "aws_bedrock_custom_model",
        "aws_bedrock_enforced_guardrail_configuration",
        "aws_bedrock_evaluation_job",
        "aws_bedrock_foundation_model_agreement",
        "aws_bedrock_guardrail",
        "aws_bedrock_guardrail_resource_policy",
        "aws_bedrock_guardrail_version",
        "aws_bedrock_inference_profile",
        "aws_bedrock_model_invocation_job",
        "aws_bedrock_model_invocation_logging_configuration",
        "aws_bedrock_provisioned_model_throughput",
        "aws_bedrock_use_case_for_model_access"
      ],
      "Bedrock Data Automation": [
        "aws_bedrockdataautomation_blueprint",
        "aws_bedrockdataautomation_library",
        "aws_bedrockdataautomation_project"
      ],
      "Billing": [
        "aws_billing_view"
      ],
      "Web Services Budgets": [
        "aws_budgets_budget",
        "aws_budgets_budget_action"
      ],
      "CE (Cost Explorer)": [
        "aws_ce_anomaly_monitor",
        "aws_ce_anomaly_subscription",
        "aws_ce_cost_allocation_tag",
        "aws_ce_cost_category"
      ],
      "Chatbot": [
        "aws_chatbot_slack_channel_configuration",
        "aws_chatbot_teams_channel_configuration"
      ],
      "Chime SDK Media Pipelines": [
        "aws_chimesdkmediapipelines_media_insights_pipeline_configuration"
      ],
      "Chime SDK Voice": [
        "aws_chimesdkvoice_global_settings",
        "aws_chimesdkvoice_sip_media_application",
        "aws_chimesdkvoice_sip_rule",
        "aws_chimesdkvoice_voice_profile_domain"
      ],
      "Chime": [
        "aws_chime_voice_connector",
        "aws_chime_voice_connector_group",
        "aws_chime_voice_connector_logging",
        "aws_chime_voice_connector_origination",
        "aws_chime_voice_connector_streaming",
        "aws_chime_voice_connector_termination",
        "aws_chime_voice_connector_termination_credentials"
      ],
      "Clean Rooms": [
        "aws_cleanrooms_collaboration",
        "aws_cleanrooms_configured_table",
        "aws_cleanrooms_membership"
      ],
      "Cloud9": [
        "aws_cloud9_environment_ec2",
        "aws_cloud9_environment_membership"
      ],
      "Cloud Control API": [
        "aws_cloudcontrolapi_resource"
      ],
      "CloudFormation": [
        "aws_cloudformation_stack",
        "aws_cloudformation_stack_instances",
        "aws_cloudformation_stack_set",
        "aws_cloudformation_stack_set_instance",
        "aws_cloudformation_type"
      ],
      "CloudFront": [
        "aws_cloudfront_anycast_ip_list",
        "aws_cloudfront_cache_policy",
        "aws_cloudfront_connection_function",
        "aws_cloudfront_connection_group",
        "aws_cloudfront_continuous_deployment_policy",
        "aws_cloudfront_distribution",
        "aws_cloudfront_distribution_tenant",
        "aws_cloudfront_field_level_encryption_config",
        "aws_cloudfront_field_level_encryption_profile",
        "aws_cloudfront_function",
        "aws_cloudfront_key_group",
        "aws_cloudfront_key_value_store",
        "aws_cloudfront_monitoring_subscription",
        "aws_cloudfront_multitenant_distribution",
        "aws_cloudfront_origin_access_control",
        "aws_cloudfront_origin_access_identity",
        "aws_cloudfront_origin_request_policy",
        "aws_cloudfront_public_key",
        "aws_cloudfront_realtime_log_config",
        "aws_cloudfront_response_headers_policy",
        "aws_cloudfront_trust_store",
        "aws_cloudfront_vpc_origin"
      ],
      "CloudFront KeyValueStore": [
        "aws_cloudfrontkeyvaluestore_key",
        "aws_cloudfrontkeyvaluestore_keys_exclusive"
      ],
      "CloudHSM": [
        "aws_cloudhsm_v2_cluster",
        "aws_cloudhsm_v2_hsm"
      ],
      "CloudSearch": [
        "aws_cloudsearch_domain",
        "aws_cloudsearch_domain_service_access_policy"
      ],
      "CloudTrail": [
        "aws_cloudtrail",
        "aws_cloudtrail_event_data_store",
        "aws_cloudtrail_organization_delegated_admin_account"
      ],
      "CloudWatch": [
        "aws_cloudwatch_alarm_mute_rule",
        "aws_cloudwatch_composite_alarm",
        "aws_cloudwatch_contributor_insight_rule",
        "aws_cloudwatch_contributor_managed_insight_rule",
        "aws_cloudwatch_dashboard",
        "aws_cloudwatch_metric_alarm",
        "aws_cloudwatch_metric_stream",
        "aws_cloudwatch_otel_enrichment",
        "aws_cloudwatch_resource_metrics_configuration"
      ],
      "EventBridge": [
        "aws_cloudwatch_event_api_destination",
        "aws_cloudwatch_event_archive",
        "aws_cloudwatch_event_bus",
        "aws_cloudwatch_event_bus_policy",
        "aws_cloudwatch_event_connection",
        "aws_cloudwatch_event_endpoint",
        "aws_cloudwatch_event_permission",
        "aws_cloudwatch_event_rule",
        "aws_cloudwatch_event_target"
      ],
      "CloudWatch Logs": [
        "aws_cloudwatch_log_account_policy",
        "aws_cloudwatch_log_anomaly_detector",
        "aws_cloudwatch_log_data_protection_policy",
        "aws_cloudwatch_log_delivery",
        "aws_cloudwatch_log_delivery_destination",
        "aws_cloudwatch_log_delivery_destination_policy",
        "aws_cloudwatch_log_delivery_source",
        "aws_cloudwatch_log_destination",
        "aws_cloudwatch_log_destination_policy",
        "aws_cloudwatch_log_group",
        "aws_cloudwatch_log_index_policy",
        "aws_cloudwatch_log_metric_filter",
        "aws_cloudwatch_log_resource_policy",
        "aws_cloudwatch_log_s3_table_integration_source",
        "aws_cloudwatch_log_storage_tier_policy",
        "aws_cloudwatch_log_stream",
        "aws_cloudwatch_log_subscription_filter",
        "aws_cloudwatch_log_transformer",
        "aws_cloudwatch_query_definition"
      ],
      "CloudWatch Omni": [
        "aws_cloudwatchomni_access_grant",
        "aws_cloudwatchomni_access_profile",
        "aws_cloudwatchomni_dashboard",
        "aws_cloudwatchomni_domain",
        "aws_cloudwatchomni_organization_domain",
        "aws_cloudwatchomni_space",
        "aws_cloudwatchomni_view"
      ],
      "CodeArtifact": [
        "aws_codeartifact_domain",
        "aws_codeartifact_domain_permissions_policy",
        "aws_codeartifact_repository",
        "aws_codeartifact_repository_permissions_policy"
      ],
      "CodeBuild": [
        "aws_codebuild_fleet",
        "aws_codebuild_project",
        "aws_codebuild_report_group",
        "aws_codebuild_resource_policy",
        "aws_codebuild_source_credential",
        "aws_codebuild_webhook"
      ],
      "CodeCatalyst": [
        "aws_codecatalyst_dev_environment",
        "aws_codecatalyst_project",
        "aws_codecatalyst_source_repository"
      ],
      "CodeCommit": [
        "aws_codecommit_approval_rule_template",
        "aws_codecommit_approval_rule_template_association",
        "aws_codecommit_repository",
        "aws_codecommit_trigger"
      ],
      "CodeConnections": [
        "aws_codeconnections_connection",
        "aws_codeconnections_host"
      ],
      "CodeDeploy": [
        "aws_codedeploy_app",
        "aws_codedeploy_deployment_config",
        "aws_codedeploy_deployment_group"
      ],
      "CodeGuru Profiler": [
        "aws_codeguruprofiler_profiling_group"
      ],
      "CodeGuru Reviewer": [
        "aws_codegurureviewer_repository_association"
      ],
      "CodePipeline": [
        "aws_codepipeline",
        "aws_codepipeline_custom_action_type",
        "aws_codepipeline_webhook"
      ],
      "CodeStar Connections": [
        "aws_codestarconnections_connection",
        "aws_codestarconnections_host"
      ],
      "CodeStar Notifications": [
        "aws_codestarnotifications_notification_rule"
      ],
      "Cognito Identity": [
        "aws_cognito_identity_pool",
        "aws_cognito_identity_pool_provider_principal_tag",
        "aws_cognito_identity_pool_roles_attachment"
      ],
      "Cognito IDP (Identity Provider)": [
        "aws_cognito_identity_provider",
        "aws_cognito_log_delivery_configuration",
        "aws_cognito_managed_login_branding",
        "aws_cognito_managed_user_pool_client",
        "aws_cognito_resource_server",
        "aws_cognito_risk_configuration",
        "aws_cognito_user",
        "aws_cognito_user_group",
        "aws_cognito_user_in_group",
        "aws_cognito_user_pool",
        "aws_cognito_user_pool_client",
        "aws_cognito_user_pool_domain",
        "aws_cognito_user_pool_ui_customization"
      ],
      "Comprehend": [
        "aws_comprehend_document_classifier",
        "aws_comprehend_entity_recognizer"
      ],
      "Compute Optimizer": [
        "aws_computeoptimizer_enrollment_status",
        "aws_computeoptimizer_recommendation_preferences"
      ],
      "Config": [
        "aws_config_aggregate_authorization",
        "aws_config_config_rule",
        "aws_config_configuration_aggregator",
        "aws_config_configuration_recorder",
        "aws_config_configuration_recorder_status",
        "aws_config_conformance_pack",
        "aws_config_connector",
        "aws_config_delivery_channel",
        "aws_config_organization_conformance_pack",
        "aws_config_organization_custom_policy_rule",
        "aws_config_organization_custom_rule",
        "aws_config_organization_managed_rule",
        "aws_config_remediation_configuration",
        "aws_config_retention_configuration"
      ],
      "Connect": [
        "aws_connect_bot_association",
        "aws_connect_contact_flow",
        "aws_connect_contact_flow_module",
        "aws_connect_hours_of_operation",
        "aws_connect_instance",
        "aws_connect_instance_storage_config",
        "aws_connect_lambda_function_association",
        "aws_connect_phone_number",
        "aws_connect_phone_number_contact_flow_association",
        "aws_connect_queue",
        "aws_connect_quick_connect",
        "aws_connect_routing_profile",
        "aws_connect_security_profile",
        "aws_connect_user",
        "aws_connect_user_hierarchy_group",
        "aws_connect_user_hierarchy_structure",
        "aws_connect_vocabulary"
      ],
      "Control Tower": [
        "aws_controltower_baseline",
        "aws_controltower_control",
        "aws_controltower_landing_zone"
      ],
      "Cost Optimization Hub": [
        "aws_costoptimizationhub_enrollment_status",
        "aws_costoptimizationhub_preferences"
      ],
      "Cost and Usage Report": [
        "aws_cur_report_definition"
      ],
      "VPN (Site-to-Site)": [
        "aws_customer_gateway",
        "aws_vpn_concentrator",
        "aws_vpn_connection",
        "aws_vpn_connection_route",
        "aws_vpn_gateway",
        "aws_vpn_gateway_attachment",
        "aws_vpn_gateway_route_propagation"
      ],
      "Connect Customer Profiles": [
        "aws_customerprofiles_domain",
        "aws_customerprofiles_profile"
      ],
      "Data Exchange": [
        "aws_dataexchange_data_set",
        "aws_dataexchange_event_action",
        "aws_dataexchange_revision",
        "aws_dataexchange_revision_assets"
      ],
      "Data Pipeline": [
        "aws_datapipeline_pipeline",
        "aws_datapipeline_pipeline_definition"
      ],
      "DataSync": [
        "aws_datasync_agent",
        "aws_datasync_location_azure_blob",
        "aws_datasync_location_efs",
        "aws_datasync_location_fsx_lustre_file_system",
        "aws_datasync_location_fsx_ontap_file_system",
        "aws_datasync_location_fsx_openzfs_file_system",
        "aws_datasync_location_fsx_windows_file_system",
        "aws_datasync_location_hdfs",
        "aws_datasync_location_nfs",
        "aws_datasync_location_object_storage",
        "aws_datasync_location_s3",
        "aws_datasync_location_smb",
        "aws_datasync_task"
      ],
      "DataZone": [
        "aws_datazone_asset_type",
        "aws_datazone_domain",
        "aws_datazone_environment",
        "aws_datazone_environment_blueprint_configuration",
        "aws_datazone_environment_profile",
        "aws_datazone_form_type",
        "aws_datazone_glossary",
        "aws_datazone_glossary_term",
        "aws_datazone_policy_grant",
        "aws_datazone_project",
        "aws_datazone_user_profile"
      ],
      "DynamoDB Accelerator (DAX)": [
        "aws_dax_cluster",
        "aws_dax_parameter_group",
        "aws_dax_subnet_group"
      ],
      "RDS (Relational Database)": [
        "aws_db_cluster_snapshot",
        "aws_db_event_subscription",
        "aws_db_instance",
        "aws_db_instance_automated_backups_replication",
        "aws_db_instance_role_association",
        "aws_db_option_group",
        "aws_db_parameter_group",
        "aws_db_proxy",
        "aws_db_proxy_default_target_group",
        "aws_db_proxy_endpoint",
        "aws_db_proxy_target",
        "aws_db_snapshot",
        "aws_db_snapshot_copy",
        "aws_db_subnet_group",
        "aws_rds_certificate",
        "aws_rds_cluster",
        "aws_rds_cluster_activity_stream",
        "aws_rds_cluster_endpoint",
        "aws_rds_cluster_instance",
        "aws_rds_cluster_parameter_group",
        "aws_rds_cluster_role_association",
        "aws_rds_cluster_snapshot_copy",
        "aws_rds_custom_db_engine_version",
        "aws_rds_export_task",
        "aws_rds_global_cluster",
        "aws_rds_instance_state",
        "aws_rds_integration",
        "aws_rds_reserved_instance",
        "aws_rds_shard_group",
        "aws_rds_tenant_database"
      ],
      "VPC (Virtual Private Cloud)": [
        "aws_default_network_acl",
        "aws_default_route_table",
        "aws_default_security_group",
        "aws_default_subnet",
        "aws_default_vpc",
        "aws_default_vpc_dhcp_options",
        "aws_ec2_managed_prefix_list",
        "aws_ec2_managed_prefix_list_entry",
        "aws_ec2_network_insights_access_scope",
        "aws_ec2_network_insights_analysis",
        "aws_ec2_network_insights_path",
        "aws_ec2_subnet_cidr_reservation",
        "aws_ec2_traffic_mirror_filter",
        "aws_ec2_traffic_mirror_filter_rule",
        "aws_ec2_traffic_mirror_session",
        "aws_ec2_traffic_mirror_target",
        "aws_egress_only_internet_gateway",
        "aws_flow_log",
        "aws_internet_gateway",
        "aws_internet_gateway_attachment",
        "aws_main_route_table_association",
        "aws_nat_gateway",
        "aws_nat_gateway_eip_association",
        "aws_network_acl",
        "aws_network_acl_association",
        "aws_network_acl_rule",
        "aws_network_interface",
        "aws_network_interface_attachment",
        "aws_network_interface_permission",
        "aws_network_interface_sg_attachment",
        "aws_route",
        "aws_route_table",
        "aws_route_table_association",
        "aws_security_group",
        "aws_security_group_rule",
        "aws_subnet",
        "aws_vpc",
        "aws_vpc_block_public_access_exclusion",
        "aws_vpc_block_public_access_options",
        "aws_vpc_dhcp_options",
        "aws_vpc_dhcp_options_association",
        "aws_vpc_encryption_control",
        "aws_vpc_endpoint",
        "aws_vpc_endpoint_connection_accepter",
        "aws_vpc_endpoint_connection_notification",
        "aws_vpc_endpoint_policy",
        "aws_vpc_endpoint_private_dns",
        "aws_vpc_endpoint_route_table_association",
        "aws_vpc_endpoint_security_group_association",
        "aws_vpc_endpoint_service",
        "aws_vpc_endpoint_service_allowed_principal",
        "aws_vpc_endpoint_service_private_dns_verification",
        "aws_vpc_endpoint_subnet_association",
        "aws_vpc_ipv4_cidr_block_association",
        "aws_vpc_ipv6_cidr_block_association",
        "aws_vpc_network_performance_metric_subscription",
        "aws_vpc_peering_connection",
        "aws_vpc_peering_connection_accepter",
        "aws_vpc_peering_connection_options",
        "aws_vpc_route_server",
        "aws_vpc_route_server_endpoint",
        "aws_vpc_route_server_peer",
        "aws_vpc_route_server_propagation",
        "aws_vpc_route_server_vpc_association",
        "aws_vpc_security_group_egress_rule",
        "aws_vpc_security_group_ingress_rule",
        "aws_vpc_security_group_rules_exclusive",
        "aws_vpc_security_group_vpc_association"
      ],
      "Detective": [
        "aws_detective_graph",
        "aws_detective_invitation_accepter",
        "aws_detective_member",
        "aws_detective_organization_admin_account",
        "aws_detective_organization_configuration"
      ],
      "Device Farm": [
        "aws_devicefarm_device_pool",
        "aws_devicefarm_instance_profile",
        "aws_devicefarm_network_profile",
        "aws_devicefarm_project",
        "aws_devicefarm_test_grid_project",
        "aws_devicefarm_upload"
      ],
      "DevOps Agent": [
        "aws_devopsagent_agent_space",
        "aws_devopsagent_asset"
      ],
      "DevOps Guru": [
        "aws_devopsguru_event_sources_config",
        "aws_devopsguru_notification_channel",
        "aws_devopsguru_resource_collection",
        "aws_devopsguru_service_integration"
      ],
      "Directory Service": [
        "aws_directory_service_conditional_forwarder",
        "aws_directory_service_directory",
        "aws_directory_service_directory_setting",
        "aws_directory_service_ip_route",
        "aws_directory_service_ip_routes_exclusive",
        "aws_directory_service_log_subscription",
        "aws_directory_service_radius_settings",
        "aws_directory_service_region",
        "aws_directory_service_shared_directory",
        "aws_directory_service_shared_directory_accepter",
        "aws_directory_service_trust"
      ],
      "Directory Service Data": [
        "aws_directoryservicedata_group",
        "aws_directoryservicedata_user"
      ],
      "DLM (Data Lifecycle Manager)": [
        "aws_dlm_lifecycle_policy"
      ],
      "DMS (Database Migration)": [
        "aws_dms_certificate",
        "aws_dms_data_provider",
        "aws_dms_endpoint",
        "aws_dms_event_subscription",
        "aws_dms_instance_profile",
        "aws_dms_migration_project",
        "aws_dms_replication_config",
        "aws_dms_replication_instance",
        "aws_dms_replication_subnet_group",
        "aws_dms_replication_task",
        "aws_dms_s3_endpoint"
      ],
      "DocumentDB": [
        "aws_docdb_cluster",
        "aws_docdb_cluster_instance",
        "aws_docdb_cluster_parameter_group",
        "aws_docdb_cluster_snapshot",
        "aws_docdb_event_subscription",
        "aws_docdb_global_cluster",
        "aws_docdb_subnet_group"
      ],
      "DocumentDB Elastic": [
        "aws_docdbelastic_cluster"
      ],
      "DRS (Elastic Disaster Recovery)": [
        "aws_drs_replication_configuration_template"
      ],
      "DSQL": [
        "aws_dsql_cluster",
        "aws_dsql_cluster_peering",
        "aws_dsql_cluster_policy",
        "aws_dsql_stream"
      ],
      "Direct Connect": [
        "aws_dx_bgp_peer",
        "aws_dx_connection",
        "aws_dx_connection_association",
        "aws_dx_connection_confirmation",
        "aws_dx_gateway",
        "aws_dx_gateway_association",
        "aws_dx_gateway_association_proposal",
        "aws_dx_hosted_connection",
        "aws_dx_hosted_private_virtual_interface",
        "aws_dx_hosted_private_virtual_interface_accepter",
        "aws_dx_hosted_public_virtual_interface",
        "aws_dx_hosted_public_virtual_interface_accepter",
        "aws_dx_hosted_transit_virtual_interface",
        "aws_dx_hosted_transit_virtual_interface_accepter",
        "aws_dx_lag",
        "aws_dx_macsec_key_association",
        "aws_dx_private_virtual_interface",
        "aws_dx_public_virtual_interface",
        "aws_dx_transit_virtual_interface"
      ],
      "DynamoDB": [
        "aws_dynamodb_contributor_insights",
        "aws_dynamodb_global_secondary_index",
        "aws_dynamodb_global_table",
        "aws_dynamodb_kinesis_streaming_destination",
        "aws_dynamodb_resource_policy",
        "aws_dynamodb_table",
        "aws_dynamodb_table_export",
        "aws_dynamodb_table_item",
        "aws_dynamodb_table_replica",
        "aws_dynamodb_tag"
      ],
      "EBS (EC2)": [
        "aws_ebs_default_kms_key",
        "aws_ebs_encryption_by_default",
        "aws_ebs_fast_snapshot_restore",
        "aws_ebs_snapshot",
        "aws_ebs_snapshot_block_public_access",
        "aws_ebs_snapshot_copy",
        "aws_ebs_snapshot_import",
        "aws_ebs_volume",
        "aws_ebs_volume_copy",
        "aws_snapshot_create_volume_permission",
        "aws_volume_attachment"
      ],
      "Wavelength": [
        "aws_ec2_carrier_gateway"
      ],
      "VPN (Client)": [
        "aws_ec2_client_vpn_authorization_rule",
        "aws_ec2_client_vpn_endpoint",
        "aws_ec2_client_vpn_network_association",
        "aws_ec2_client_vpn_route"
      ],
      "Outposts (EC2)": [
        "aws_ec2_local_gateway_route",
        "aws_ec2_local_gateway_route_table",
        "aws_ec2_local_gateway_route_table_virtual_interface_group_association",
        "aws_ec2_local_gateway_route_table_vpc_association"
      ],
      "Transit Gateway": [
        "aws_ec2_transit_gateway",
        "aws_ec2_transit_gateway_connect",
        "aws_ec2_transit_gateway_connect_peer",
        "aws_ec2_transit_gateway_default_route_table_association",
        "aws_ec2_transit_gateway_default_route_table_propagation",
        "aws_ec2_transit_gateway_metering_policy",
        "aws_ec2_transit_gateway_metering_policy_entry",
        "aws_ec2_transit_gateway_multicast_domain",
        "aws_ec2_transit_gateway_multicast_domain_association",
        "aws_ec2_transit_gateway_multicast_group_member",
        "aws_ec2_transit_gateway_multicast_group_source",
        "aws_ec2_transit_gateway_peering_attachment",
        "aws_ec2_transit_gateway_peering_attachment_accepter",
        "aws_ec2_transit_gateway_policy_table",
        "aws_ec2_transit_gateway_policy_table_association",
        "aws_ec2_transit_gateway_policy_table_entry",
        "aws_ec2_transit_gateway_prefix_list_reference",
        "aws_ec2_transit_gateway_route",
        "aws_ec2_transit_gateway_route_table",
        "aws_ec2_transit_gateway_route_table_association",
        "aws_ec2_transit_gateway_route_table_propagation",
        "aws_ec2_transit_gateway_vpc_attachment",
        "aws_ec2_transit_gateway_vpc_attachment_accepter"
      ],
      "ECR (Elastic Container Registry)": [
        "aws_ecr_account_setting",
        "aws_ecr_lifecycle_policy",
        "aws_ecr_pull_through_cache_rule",
        "aws_ecr_pull_time_update_exclusion",
        "aws_ecr_registry_policy",
        "aws_ecr_registry_scanning_configuration",
        "aws_ecr_replication_configuration",
        "aws_ecr_repository",
        "aws_ecr_repository_creation_template",
        "aws_ecr_repository_policy"
      ],
      "ECR Public": [
        "aws_ecrpublic_repository",
        "aws_ecrpublic_repository_policy"
      ],
      "ECS (Elastic Container)": [
        "aws_ecs_account_setting_default",
        "aws_ecs_capacity_provider",
        "aws_ecs_cluster",
        "aws_ecs_cluster_capacity_providers",
        "aws_ecs_daemon",
        "aws_ecs_daemon_task_definition",
        "aws_ecs_express_gateway_service",
        "aws_ecs_service",
        "aws_ecs_tag",
        "aws_ecs_task_definition",
        "aws_ecs_task_set"
      ],
      "EFS (Elastic File System)": [
        "aws_efs_access_point",
        "aws_efs_backup_policy",
        "aws_efs_file_system",
        "aws_efs_file_system_policy",
        "aws_efs_mount_target",
        "aws_efs_replication_configuration"
      ],
      "EKS (Elastic Kubernetes)": [
        "aws_eks_access_entry",
        "aws_eks_access_policy_association",
        "aws_eks_addon",
        "aws_eks_capability",
        "aws_eks_cluster",
        "aws_eks_fargate_profile",
        "aws_eks_identity_provider_config",
        "aws_eks_node_group",
        "aws_eks_pod_identity_association"
      ],
      "ElastiCache": [
        "aws_elasticache_cluster",
        "aws_elasticache_global_replication_group",
        "aws_elasticache_parameter_group",
        "aws_elasticache_replication_group",
        "aws_elasticache_reserved_cache_node",
        "aws_elasticache_serverless_cache",
        "aws_elasticache_subnet_group",
        "aws_elasticache_user",
        "aws_elasticache_user_group",
        "aws_elasticache_user_group_association"
      ],
      "Elastic Beanstalk": [
        "aws_elastic_beanstalk_application",
        "aws_elastic_beanstalk_application_version",
        "aws_elastic_beanstalk_configuration_template",
        "aws_elastic_beanstalk_environment"
      ],
      "Elasticsearch": [
        "aws_elasticsearch_domain",
        "aws_elasticsearch_domain_policy",
        "aws_elasticsearch_domain_saml_options",
        "aws_elasticsearch_vpc_endpoint"
      ],
      "Elastic Transcoder": [
        "aws_elastictranscoder_pipeline",
        "aws_elastictranscoder_preset"
      ],
      "EMR": [
        "aws_emr_block_public_access_configuration",
        "aws_emr_cluster",
        "aws_emr_instance_fleet",
        "aws_emr_instance_group",
        "aws_emr_managed_scaling_policy",
        "aws_emr_security_configuration",
        "aws_emr_studio",
        "aws_emr_studio_session_mapping"
      ],
      "EMR Containers": [
        "aws_emrcontainers_job_template",
        "aws_emrcontainers_virtual_cluster"
      ],
      "EMR Serverless": [
        "aws_emrserverless_application"
      ],
      "CloudWatch Evidently": [
        "aws_evidently_feature",
        "aws_evidently_launch",
        "aws_evidently_project",
        "aws_evidently_segment"
      ],
      "FinSpace": [
        "aws_finspace_kx_cluster",
        "aws_finspace_kx_database",
        "aws_finspace_kx_dataview",
        "aws_finspace_kx_environment",
        "aws_finspace_kx_scaling_group",
        "aws_finspace_kx_user",
        "aws_finspace_kx_volume"
      ],
      "FIS (Fault Injection Simulator)": [
        "aws_fis_experiment_template",
        "aws_fis_safety_lever_state",
        "aws_fis_target_account_configuration"
      ],
      "FMS (Firewall Manager)": [
        "aws_fms_admin_account",
        "aws_fms_policy",
        "aws_fms_resource_set"
      ],
      "FSx": [
        "aws_fsx_backup",
        "aws_fsx_data_repository_association",
        "aws_fsx_file_cache",
        "aws_fsx_lustre_file_system",
        "aws_fsx_ontap_file_system",
        "aws_fsx_ontap_storage_virtual_machine",
        "aws_fsx_ontap_volume",
        "aws_fsx_openzfs_file_system",
        "aws_fsx_openzfs_snapshot",
        "aws_fsx_openzfs_volume",
        "aws_fsx_s3_access_point_attachment",
        "aws_fsx_windows_file_system"
      ],
      "GameLift": [
        "aws_gamelift_alias",
        "aws_gamelift_build",
        "aws_gamelift_fleet",
        "aws_gamelift_game_server_group",
        "aws_gamelift_game_session_queue",
        "aws_gamelift_script"
      ],
      "S3 Glacier": [
        "aws_glacier_vault",
        "aws_glacier_vault_lock"
      ],
      "Global Accelerator": [
        "aws_globalaccelerator_accelerator",
        "aws_globalaccelerator_cross_account_attachment",
        "aws_globalaccelerator_custom_routing_accelerator",
        "aws_globalaccelerator_custom_routing_endpoint_group",
        "aws_globalaccelerator_custom_routing_listener",
        "aws_globalaccelerator_endpoint_group",
        "aws_globalaccelerator_listener"
      ],
      "Glue": [
        "aws_glue_catalog",
        "aws_glue_catalog_database",
        "aws_glue_catalog_table",
        "aws_glue_catalog_table_optimizer",
        "aws_glue_classifier",
        "aws_glue_connection",
        "aws_glue_crawler",
        "aws_glue_data_catalog_encryption_settings",
        "aws_glue_data_quality_ruleset",
        "aws_glue_dev_endpoint",
        "aws_glue_job",
        "aws_glue_ml_transform",
        "aws_glue_partition",
        "aws_glue_partition_index",
        "aws_glue_registry",
        "aws_glue_resource_policy",
        "aws_glue_schema",
        "aws_glue_security_configuration",
        "aws_glue_trigger",
        "aws_glue_user_defined_function",
        "aws_glue_workflow"
      ],
      "Managed Grafana": [
        "aws_grafana_license_association",
        "aws_grafana_role_association",
        "aws_grafana_workspace",
        "aws_grafana_workspace_api_key",
        "aws_grafana_workspace_saml_configuration",
        "aws_grafana_workspace_service_account",
        "aws_grafana_workspace_service_account_token"
      ],
      "GuardDuty": [
        "aws_guardduty_detector",
        "aws_guardduty_detector_feature",
        "aws_guardduty_filter",
        "aws_guardduty_invite_accepter",
        "aws_guardduty_ipset",
        "aws_guardduty_malware_protection_plan",
        "aws_guardduty_member",
        "aws_guardduty_member_detector_feature",
        "aws_guardduty_organization_admin_account",
        "aws_guardduty_organization_configuration",
        "aws_guardduty_organization_configuration_feature",
        "aws_guardduty_publishing_destination",
        "aws_guardduty_threatintelset"
      ],
      "IAM (Identity & Access Management)": [
        "aws_iam_access_key",
        "aws_iam_account_alias",
        "aws_iam_account_password_policy",
        "aws_iam_group",
        "aws_iam_group_membership",
        "aws_iam_group_policies_exclusive",
        "aws_iam_group_policy",
        "aws_iam_group_policy_attachment",
        "aws_iam_group_policy_attachments_exclusive",
        "aws_iam_instance_profile",
        "aws_iam_openid_connect_provider",
        "aws_iam_organizations_features",
        "aws_iam_outbound_web_identity_federation",
        "aws_iam_policy",
        "aws_iam_policy_attachment",
        "aws_iam_role",
        "aws_iam_role_policies_exclusive",
        "aws_iam_role_policy",
        "aws_iam_role_policy_attachment",
        "aws_iam_role_policy_attachments_exclusive",
        "aws_iam_saml_provider",
        "aws_iam_security_token_service_preferences",
        "aws_iam_server_certificate",
        "aws_iam_service_linked_role",
        "aws_iam_service_specific_credential",
        "aws_iam_signing_certificate",
        "aws_iam_user",
        "aws_iam_user_group_membership",
        "aws_iam_user_login_profile",
        "aws_iam_user_policies_exclusive",
        "aws_iam_user_policy",
        "aws_iam_user_policy_attachment",
        "aws_iam_user_policy_attachments_exclusive",
        "aws_iam_user_ssh_key",
        "aws_iam_virtual_mfa_device"
      ],
      "SSO Identity Store": [
        "aws_identitystore_group",
        "aws_identitystore_group_membership",
        "aws_identitystore_user"
      ],
      "EC2 Image Builder": [
        "aws_imagebuilder_component",
        "aws_imagebuilder_container_recipe",
        "aws_imagebuilder_distribution_configuration",
        "aws_imagebuilder_image",
        "aws_imagebuilder_image_pipeline",
        "aws_imagebuilder_image_recipe",
        "aws_imagebuilder_infrastructure_configuration",
        "aws_imagebuilder_lifecycle_policy",
        "aws_imagebuilder_workflow"
      ],
      "Inspector": [
        "aws_inspector2_delegated_admin_account",
        "aws_inspector2_enabler",
        "aws_inspector2_filter",
        "aws_inspector2_member_association",
        "aws_inspector2_organization_configuration"
      ],
      "Inspector Classic": [
        "aws_inspector_assessment_target",
        "aws_inspector_assessment_template",
        "aws_inspector_resource_group"
      ],
      "CloudWatch Internet Monitor": [
        "aws_internetmonitor_monitor"
      ],
      "Invoicing": [
        "aws_invoicing_invoice_unit"
      ],
      "IoT Core": [
        "aws_iot_authorizer",
        "aws_iot_billing_group",
        "aws_iot_ca_certificate",
        "aws_iot_certificate",
        "aws_iot_domain_configuration",
        "aws_iot_event_configurations",
        "aws_iot_indexing_configuration",
        "aws_iot_logging_options",
        "aws_iot_policy",
        "aws_iot_policy_attachment",
        "aws_iot_provisioning_template",
        "aws_iot_role_alias",
        "aws_iot_thing",
        "aws_iot_thing_group",
        "aws_iot_thing_group_membership",
        "aws_iot_thing_principal_attachment",
        "aws_iot_thing_type",
        "aws_iot_topic_rule",
        "aws_iot_topic_rule_destination"
      ],
      "IVS (Interactive Video)": [
        "aws_ivs_channel",
        "aws_ivs_playback_key_pair",
        "aws_ivs_recording_configuration"
      ],
      "IVS (Interactive Video) Chat": [
        "aws_ivschat_logging_configuration",
        "aws_ivschat_room"
      ],
      "Kendra": [
        "aws_kendra_data_source",
        "aws_kendra_experience",
        "aws_kendra_faq",
        "aws_kendra_index",
        "aws_kendra_query_suggestions_block_list",
        "aws_kendra_thesaurus"
      ],
      "Keyspaces (for Apache Cassandra)": [
        "aws_keyspaces_keyspace",
        "aws_keyspaces_table"
      ],
      "Kinesis": [
        "aws_kinesis_account_settings",
        "aws_kinesis_resource_policy",
        "aws_kinesis_stream",
        "aws_kinesis_stream_consumer"
      ],
      "Kinesis Analytics": [
        "aws_kinesis_analytics_application"
      ],
      "Kinesis Analytics V2": [
        "aws_kinesisanalyticsv2_application",
        "aws_kinesisanalyticsv2_application_snapshot"
      ],
      "Kinesis Firehose": [
        "aws_kinesis_firehose_delivery_stream"
      ],
      "Kinesis Video": [
        "aws_kinesis_video_stream"
      ],
      "KMS (Key Management)": [
        "aws_kms_alias",
        "aws_kms_ciphertext",
        "aws_kms_custom_key_store",
        "aws_kms_external_key",
        "aws_kms_grant",
        "aws_kms_key",
        "aws_kms_key_policy",
        "aws_kms_replica_external_key",
        "aws_kms_replica_key"
      ],
      "Lake Formation": [
        "aws_lakeformation_data_cells_filter",
        "aws_lakeformation_data_lake_settings",
        "aws_lakeformation_identity_center_configuration",
        "aws_lakeformation_lf_tag",
        "aws_lakeformation_lf_tag_expression",
        "aws_lakeformation_opt_in",
        "aws_lakeformation_permissions",
        "aws_lakeformation_resource",
        "aws_lakeformation_resource_lf_tag",
        "aws_lakeformation_resource_lf_tags"
      ],
      "Lambda": [
        "aws_lambda_alias",
        "aws_lambda_capacity_provider",
        "aws_lambda_code_signing_config",
        "aws_lambda_event_source_mapping",
        "aws_lambda_function",
        "aws_lambda_function_event_invoke_config",
        "aws_lambda_function_recursion_config",
        "aws_lambda_function_scaling_config",
        "aws_lambda_function_url",
        "aws_lambda_invocation",
        "aws_lambda_layer_version",
        "aws_lambda_layer_version_permission",
        "aws_lambda_permission",
        "aws_lambda_provisioned_concurrency_config",
        "aws_lambda_resource_policy",
        "aws_lambda_runtime_management_config"
      ],
      "Lambda Core": [
        "aws_lambdacore_network_connector"
      ],
      "Lambda MicroVMs": [
        "aws_lambdamicrovms_image",
        "aws_lambdamicrovms_microvm"
      ],
      "Lambda Web": [
        "aws_lambdaweb_function",
        "aws_lambdaweb_function_endpoint",
        "aws_lambdaweb_function_revision",
        "aws_lambdaweb_resource_policy"
      ],
      "ELB (Elastic Load Balancing)": [
        "aws_lb",
        "aws_lb_listener",
        "aws_lb_listener_certificate",
        "aws_lb_listener_rule",
        "aws_lb_target_group",
        "aws_lb_target_group_attachment",
        "aws_lb_trust_store",
        "aws_lb_trust_store_revocation"
      ],
      "Lex Model Building": [
        "aws_lex_bot",
        "aws_lex_bot_alias",
        "aws_lex_intent",
        "aws_lex_slot_type"
      ],
      "Lex V2 Models": [
        "aws_lexv2models_bot",
        "aws_lexv2models_bot_locale",
        "aws_lexv2models_bot_version",
        "aws_lexv2models_intent",
        "aws_lexv2models_slot",
        "aws_lexv2models_slot_type"
      ],
      "License Manager": [
        "aws_licensemanager_association",
        "aws_licensemanager_grant",
        "aws_licensemanager_grant_accepter",
        "aws_licensemanager_license_configuration"
      ],
      "Lightsail": [
        "aws_lightsail_bucket",
        "aws_lightsail_bucket_access_key",
        "aws_lightsail_bucket_resource_access",
        "aws_lightsail_certificate",
        "aws_lightsail_container_service",
        "aws_lightsail_container_service_deployment_version",
        "aws_lightsail_database",
        "aws_lightsail_disk",
        "aws_lightsail_disk_attachment",
        "aws_lightsail_distribution",
        "aws_lightsail_domain",
        "aws_lightsail_domain_entry",
        "aws_lightsail_instance",
        "aws_lightsail_instance_public_ports",
        "aws_lightsail_key_pair",
        "aws_lightsail_lb",
        "aws_lightsail_lb_attachment",
        "aws_lightsail_lb_certificate",
        "aws_lightsail_lb_certificate_attachment",
        "aws_lightsail_lb_https_redirection_policy",
        "aws_lightsail_lb_stickiness_policy",
        "aws_lightsail_static_ip",
        "aws_lightsail_static_ip_attachment"
      ],
      "Location": [
        "aws_location_geofence_collection",
        "aws_location_map",
        "aws_location_place_index",
        "aws_location_route_calculator",
        "aws_location_tracker",
        "aws_location_tracker_association"
      ],
      "Mainframe Modernization": [
        "aws_m2_application",
        "aws_m2_deployment",
        "aws_m2_environment"
      ],
      "Macie": [
        "aws_macie2_account",
        "aws_macie2_classification_export_configuration",
        "aws_macie2_classification_job",
        "aws_macie2_custom_data_identifier",
        "aws_macie2_findings_filter",
        "aws_macie2_invitation_accepter",
        "aws_macie2_member",
        "aws_macie2_organization_admin_account",
        "aws_macie2_organization_configuration"
      ],
      "SES Mail Manager": [
        "aws_mailmanager_archive",
        "aws_mailmanager_ingress_point",
        "aws_mailmanager_relay",
        "aws_mailmanager_rule_set",
        "aws_mailmanager_traffic_policy"
      ],
      "Elemental MediaConvert": [
        "aws_media_convert_queue"
      ],
      "Elemental MediaLive": [
        "aws_medialive_channel",
        "aws_medialive_input",
        "aws_medialive_input_security_group",
        "aws_medialive_multiplex",
        "aws_medialive_multiplex_program"
      ],
      "Elemental MediaPackage": [
        "aws_media_package_channel"
      ],
      "Elemental MediaPackage Version 2": [
        "aws_media_packagev2_channel_group"
      ],
      "Elemental MediaStore": [
        "aws_media_store_container",
        "aws_media_store_container_policy"
      ],
      "MemoryDB": [
        "aws_memorydb_acl",
        "aws_memorydb_cluster",
        "aws_memorydb_multi_region_cluster",
        "aws_memorydb_parameter_group",
        "aws_memorydb_snapshot",
        "aws_memorydb_subnet_group",
        "aws_memorydb_user"
      ],
      "MQ": [
        "aws_mq_broker",
        "aws_mq_configuration"
      ],
      "Managed Streaming for Kafka": [
        "aws_msk_channel",
        "aws_msk_cluster",
        "aws_msk_cluster_policy",
        "aws_msk_configuration",
        "aws_msk_replicator",
        "aws_msk_scram_secret_association",
        "aws_msk_serverless_cluster",
        "aws_msk_single_scram_secret_association",
        "aws_msk_topic",
        "aws_msk_vpc_connection"
      ],
      "Managed Streaming for Kafka Connect": [
        "aws_mskconnect_connector",
        "aws_mskconnect_custom_plugin",
        "aws_mskconnect_worker_configuration"
      ],
      "MWAA (Managed Workflows for Apache Airflow)": [
        "aws_mwaa_environment"
      ],
      "Neptune": [
        "aws_neptune_cluster",
        "aws_neptune_cluster_endpoint",
        "aws_neptune_cluster_instance",
        "aws_neptune_cluster_parameter_group",
        "aws_neptune_cluster_snapshot",
        "aws_neptune_event_subscription",
        "aws_neptune_global_cluster",
        "aws_neptune_parameter_group",
        "aws_neptune_subnet_group"
      ],
      "Neptune Analytics": [
        "aws_neptunegraph_graph",
        "aws_neptunegraph_private_graph_endpoint"
      ],
      "Network Firewall": [
        "aws_networkfirewall_container_association",
        "aws_networkfirewall_firewall",
        "aws_networkfirewall_firewall_policy",
        "aws_networkfirewall_firewall_transit_gateway_attachment_accepter",
        "aws_networkfirewall_logging_configuration",
        "aws_networkfirewall_resource_policy",
        "aws_networkfirewall_rule_group",
        "aws_networkfirewall_tls_inspection_configuration",
        "aws_networkfirewall_vpc_endpoint_association"
      ],
      "CloudWatch NetworkFlow Monitor": [
        "aws_networkflowmonitor_monitor",
        "aws_networkflowmonitor_scope"
      ],
      "Network Manager": [
        "aws_networkmanager_attachment_accepter",
        "aws_networkmanager_attachment_routing_policy_label",
        "aws_networkmanager_connect_attachment",
        "aws_networkmanager_connection",
        "aws_networkmanager_connect_peer",
        "aws_networkmanager_core_network",
        "aws_networkmanager_core_network_policy_attachment",
        "aws_networkmanager_customer_gateway_association",
        "aws_networkmanager_device",
        "aws_networkmanager_dx_gateway_attachment",
        "aws_networkmanager_global_network",
        "aws_networkmanager_link",
        "aws_networkmanager_link_association",
        "aws_networkmanager_prefix_list_association",
        "aws_networkmanager_site",
        "aws_networkmanager_site_to_site_vpn_attachment",
        "aws_networkmanager_transit_gateway_connect_peer_association",
        "aws_networkmanager_transit_gateway_peering",
        "aws_networkmanager_transit_gateway_registration",
        "aws_networkmanager_transit_gateway_route_table_attachment",
        "aws_networkmanager_vpc_attachment"
      ],
      "CloudWatch Network Monitor": [
        "aws_networkmonitor_monitor",
        "aws_networkmonitor_probe"
      ],
      "Network Security Manager": [
        "aws_networksecuritymanager_admin_account",
        "aws_networksecuritymanager_deployment",
        "aws_networksecuritymanager_policy",
        "aws_networksecuritymanager_rule",
        "aws_networksecuritymanager_scope",
        "aws_networksecuritymanager_template"
      ],
      "User Notifications": [
        "aws_notifications_channel_association",
        "aws_notifications_event_rule",
        "aws_notifications_managed_notification_account_contact_association",
        "aws_notifications_managed_notification_additional_channel_association",
        "aws_notifications_notification_configuration",
        "aws_notifications_notification_hub",
        "aws_notifications_organizational_unit_association",
        "aws_notifications_organizations_access"
      ],
      "User Notifications Contacts": [
        "aws_notificationscontacts_email_contact"
      ],
      "CloudWatch Observability Access Manager": [
        "aws_oam_link",
        "aws_oam_sink",
        "aws_oam_sink_policy"
      ],
      "CloudWatch Observability Admin": [
        "aws_observabilityadmin_centralization_rule_for_organization",
        "aws_observabilityadmin_dataset_integration",
        "aws_observabilityadmin_s3_table_integration",
        "aws_observabilityadmin_telemetry_enrichment",
        "aws_observabilityadmin_telemetry_evaluation",
        "aws_observabilityadmin_telemetry_evaluation_for_organization",
        "aws_observabilityadmin_telemetry_pipeline",
        "aws_observabilityadmin_telemetry_rule",
        "aws_observabilityadmin_telemetry_rule_for_organization"
      ],
      "Oracle Database@AWS": [
        "aws_odb_autonomous_database",
        "aws_odb_autonomous_database_secrets_manager_integration",
        "aws_odb_cloud_autonomous_vm_cluster",
        "aws_odb_cloud_exadata_infrastructure",
        "aws_odb_cloud_vm_cluster",
        "aws_odb_iam_role_association",
        "aws_odb_network",
        "aws_odb_network_peering_connection"
      ],
      "OpenSearch": [
        "aws_opensearch_application",
        "aws_opensearch_authorize_vpc_endpoint_access",
        "aws_opensearch_domain",
        "aws_opensearch_domain_policy",
        "aws_opensearch_domain_saml_options",
        "aws_opensearch_inbound_connection_accepter",
        "aws_opensearch_outbound_connection",
        "aws_opensearch_package",
        "aws_opensearch_package_association",
        "aws_opensearch_vpc_endpoint"
      ],
      "OpenSearch Serverless": [
        "aws_opensearchserverless_access_policy",
        "aws_opensearchserverless_collection",
        "aws_opensearchserverless_collection_group",
        "aws_opensearchserverless_lifecycle_policy",
        "aws_opensearchserverless_security_config",
        "aws_opensearchserverless_security_policy",
        "aws_opensearchserverless_vpc_endpoint"
      ],
      "Organizations": [
        "aws_organizations_account",
        "aws_organizations_aws_service_access",
        "aws_organizations_delegated_administrator",
        "aws_organizations_organization",
        "aws_organizations_organizational_unit",
        "aws_organizations_policy",
        "aws_organizations_policy_attachment",
        "aws_organizations_resource_policy",
        "aws_organizations_tag"
      ],
      "OpenSearch Ingestion (OSIS)": [
        "aws_osis_pipeline",
        "aws_osis_pipeline_endpoint",
        "aws_osis_resource_policy"
      ],
      "Outposts": [
        "aws_outposts_capacity_task"
      ],
      "Payment Cryptography Control Plane": [
        "aws_paymentcryptography_key",
        "aws_paymentcryptography_key_alias"
      ],
      "End User Messaging": [
        "aws_pinpoint_adm_channel",
        "aws_pinpoint_apns_channel",
        "aws_pinpoint_apns_sandbox_channel",
        "aws_pinpoint_apns_voip_channel",
        "aws_pinpoint_apns_voip_sandbox_channel",
        "aws_pinpoint_app",
        "aws_pinpoint_baidu_channel",
        "aws_pinpoint_email_channel",
        "aws_pinpoint_email_template",
        "aws_pinpoint_event_stream",
        "aws_pinpoint_gcm_channel",
        "aws_pinpoint_sms_channel"
      ],
      "End User Messaging SMS": [
        "aws_pinpointsmsvoicev2_configuration_set",
        "aws_pinpointsmsvoicev2_event_destination",
        "aws_pinpointsmsvoicev2_keyword",
        "aws_pinpointsmsvoicev2_opt_out_list",
        "aws_pinpointsmsvoicev2_phone_number",
        "aws_pinpointsmsvoicev2_pool",
        "aws_pinpointsmsvoicev2_protect_configuration",
        "aws_pinpointsmsvoicev2_resource_policy",
        "aws_pinpointsmsvoicev2_sender_id"
      ],
      "EventBridge Pipes": [
        "aws_pipes_pipe"
      ],
      "Pricing Plan Manager": [
        "aws_pricingplanmanager_subscription"
      ],
      "AMP (Managed Prometheus)": [
        "aws_prometheus_alert_manager_definition",
        "aws_prometheus_anomaly_detector",
        "aws_prometheus_query_logging_configuration",
        "aws_prometheus_resource_policy",
        "aws_prometheus_rule_group_namespace",
        "aws_prometheus_scraper",
        "aws_prometheus_scraper_logging_configuration",
        "aws_prometheus_workspace",
        "aws_prometheus_workspace_configuration"
      ],
      "Amazon Q Business": [
        "aws_qbusiness_application"
      ],
      "QLDB (Quantum Ledger Database)": [
        "aws_qldb_ledger",
        "aws_qldb_stream"
      ],
      "QuickSight": [
        "aws_quicksight_account_custom_permission",
        "aws_quicksight_account_settings",
        "aws_quicksight_account_subscription",
        "aws_quicksight_analysis",
        "aws_quicksight_custom_permissions",
        "aws_quicksight_dashboard",
        "aws_quicksight_data_set",
        "aws_quicksight_data_source",
        "aws_quicksight_folder",
        "aws_quicksight_folder_membership",
        "aws_quicksight_group",
        "aws_quicksight_group_membership",
        "aws_quicksight_iam_policy_assignment",
        "aws_quicksight_ingestion",
        "aws_quicksight_ip_restriction",
        "aws_quicksight_key_registration",
        "aws_quicksight_namespace",
        "aws_quicksight_refresh_schedule",
        "aws_quicksight_role_custom_permission",
        "aws_quicksight_role_membership",
        "aws_quicksight_template",
        "aws_quicksight_template_alias",
        "aws_quicksight_theme",
        "aws_quicksight_user",
        "aws_quicksight_user_custom_permission",
        "aws_quicksight_vpc_connection"
      ],
      "RAM (Resource Access Manager)": [
        "aws_ram_permission",
        "aws_ram_principal_association",
        "aws_ram_resource_association",
        "aws_ram_resource_share",
        "aws_ram_resource_share_accepter",
        "aws_ram_resource_share_associations_exclusive",
        "aws_ram_sharing_with_organization"
      ],
      "Recycle Bin (RBin)": [
        "aws_rbin_rule"
      ],
      "Redshift": [
        "aws_redshift_authentication_profile",
        "aws_redshift_cluster",
        "aws_redshift_cluster_iam_roles",
        "aws_redshift_cluster_snapshot",
        "aws_redshift_data_share_authorization",
        "aws_redshift_data_share_consumer_association",
        "aws_redshift_endpoint_access",
        "aws_redshift_endpoint_authorization",
        "aws_redshift_event_subscription",
        "aws_redshift_hsm_client_certificate",
        "aws_redshift_hsm_configuration",
        "aws_redshift_idc_application",
        "aws_redshift_integration",
        "aws_redshift_logging",
        "aws_redshift_namespace_registration",
        "aws_redshift_parameter_group",
        "aws_redshift_partner",
        "aws_redshift_resource_policy",
        "aws_redshift_scheduled_action",
        "aws_redshift_snapshot_copy",
        "aws_redshift_snapshot_copy_grant",
        "aws_redshift_snapshot_schedule",
        "aws_redshift_snapshot_schedule_association",
        "aws_redshift_subnet_group",
        "aws_redshift_usage_limit"
      ],
      "Redshift Data": [
        "aws_redshiftdata_statement"
      ],
      "Redshift Serverless": [
        "aws_redshiftserverless_custom_domain_association",
        "aws_redshiftserverless_endpoint_access",
        "aws_redshiftserverless_namespace",
        "aws_redshiftserverless_resource_policy",
        "aws_redshiftserverless_snapshot",
        "aws_redshiftserverless_usage_limit",
        "aws_redshiftserverless_workgroup"
      ],
      "Rekognition": [
        "aws_rekognition_collection",
        "aws_rekognition_project",
        "aws_rekognition_stream_processor"
      ],
      "Resilience Hub": [
        "aws_resiliencehub_resiliency_policy"
      ],
      "Resilience Hub V2": [
        "aws_resiliencehubv2_assertion",
        "aws_resiliencehubv2_input_source",
        "aws_resiliencehubv2_policy",
        "aws_resiliencehubv2_service",
        "aws_resiliencehubv2_service_function",
        "aws_resiliencehubv2_system",
        "aws_resiliencehubv2_user_journey"
      ],
      "Resource Explorer": [
        "aws_resourceexplorer2_index",
        "aws_resourceexplorer2_view"
      ],
      "Resource Groups": [
        "aws_resourcegroups_group",
        "aws_resourcegroups_resource"
      ],
      "Roles Anywhere": [
        "aws_rolesanywhere_profile",
        "aws_rolesanywhere_trust_anchor"
      ],
      "Route 53": [
        "aws_route53_cidr_collection",
        "aws_route53_cidr_location",
        "aws_route53_delegation_set",
        "aws_route53_health_check",
        "aws_route53_hosted_zone_dnssec",
        "aws_route53_key_signing_key",
        "aws_route53_query_log",
        "aws_route53_record",
        "aws_route53_records_exclusive",
        "aws_route53_traffic_policy",
        "aws_route53_traffic_policy_instance",
        "aws_route53_vpc_association_authorization",
        "aws_route53_zone",
        "aws_route53_zone_association"
      ],
      "Route 53 Domains": [
        "aws_route53domains_delegation_signer_record",
        "aws_route53domains_domain",
        "aws_route53domains_registered_domain"
      ],
      "Route 53 Profiles": [
        "aws_route53profiles_association",
        "aws_route53profiles_profile",
        "aws_route53profiles_resource_association"
      ],
      "Route 53 Recovery Control Config": [
        "aws_route53recoverycontrolconfig_cluster",
        "aws_route53recoverycontrolconfig_control_panel",
        "aws_route53recoverycontrolconfig_routing_control",
        "aws_route53recoverycontrolconfig_safety_rule"
      ],
      "Route 53 Recovery Readiness": [
        "aws_route53recoveryreadiness_cell",
        "aws_route53recoveryreadiness_readiness_check",
        "aws_route53recoveryreadiness_recovery_group",
        "aws_route53recoveryreadiness_resource_set"
      ],
      "Route 53 Resolver": [
        "aws_route53_resolver_config",
        "aws_route53_resolver_dnssec_config",
        "aws_route53_resolver_endpoint",
        "aws_route53_resolver_firewall_config",
        "aws_route53_resolver_firewall_domain_list",
        "aws_route53_resolver_firewall_rule",
        "aws_route53_resolver_firewall_rule_group",
        "aws_route53_resolver_firewall_rule_group_association",
        "aws_route53_resolver_query_log_config",
        "aws_route53_resolver_query_log_config_association",
        "aws_route53_resolver_rule",
        "aws_route53_resolver_rule_association"
      ],
      "CloudWatch RUM": [
        "aws_rum_app_monitor",
        "aws_rum_metrics_destination"
      ],
      "S3 Control": [
        "aws_s3_access_point",
        "aws_s3_account_public_access_block",
        "aws_s3control_access_grant",
        "aws_s3control_access_grants_instance",
        "aws_s3control_access_grants_instance_resource_policy",
        "aws_s3control_access_grants_location",
        "aws_s3control_access_point_policy",
        "aws_s3control_bucket",
        "aws_s3control_bucket_lifecycle_configuration",
        "aws_s3control_bucket_policy",
        "aws_s3control_directory_bucket_access_point_scope",
        "aws_s3control_multi_region_access_point",
        "aws_s3control_multi_region_access_point_policy",
        "aws_s3control_multi_region_access_point_routes",
        "aws_s3control_object_lambda_access_point",
        "aws_s3control_object_lambda_access_point_policy",
        "aws_s3control_storage_lens_configuration"
      ],
      "S3 (Simple Storage)": [
        "aws_s3_bucket",
        "aws_s3_bucket_abac",
        "aws_s3_bucket_accelerate_configuration",
        "aws_s3_bucket_acl",
        "aws_s3_bucket_analytics_configuration",
        "aws_s3_bucket_cors_configuration",
        "aws_s3_bucket_intelligent_tiering_configuration",
        "aws_s3_bucket_inventory",
        "aws_s3_bucket_lifecycle_configuration",
        "aws_s3_bucket_logging",
        "aws_s3_bucket_metadata_configuration",
        "aws_s3_bucket_metric",
        "aws_s3_bucket_notification",
        "aws_s3_bucket_object",
        "aws_s3_bucket_object_lock_configuration",
        "aws_s3_bucket_ownership_controls",
        "aws_s3_bucket_policy",
        "aws_s3_bucket_public_access_block",
        "aws_s3_bucket_replication_configuration",
        "aws_s3_bucket_request_payment_configuration",
        "aws_s3_bucket_server_side_encryption_configuration",
        "aws_s3_bucket_versioning",
        "aws_s3_bucket_website_configuration",
        "aws_s3_directory_bucket",
        "aws_s3_object",
        "aws_s3_object_copy"
      ],
      "S3 Files": [
        "aws_s3files_access_point",
        "aws_s3files_file_system",
        "aws_s3files_file_system_policy",
        "aws_s3files_mount_target",
        "aws_s3files_synchronization_configuration"
      ],
      "S3 on Outposts": [
        "aws_s3outposts_endpoint"
      ],
      "S3 Tables": [
        "aws_s3tables_namespace",
        "aws_s3tables_table",
        "aws_s3tables_table_bucket",
        "aws_s3tables_table_bucket_policy",
        "aws_s3tables_table_bucket_replication",
        "aws_s3tables_table_policy",
        "aws_s3tables_table_replication"
      ],
      "S3 Vectors": [
        "aws_s3vectors_index",
        "aws_s3vectors_vector_bucket",
        "aws_s3vectors_vector_bucket_policy"
      ],
      "SageMaker AI": [
        "aws_sagemaker_algorithm",
        "aws_sagemaker_app",
        "aws_sagemaker_app_image_config",
        "aws_sagemaker_code_repository",
        "aws_sagemaker_data_quality_job_definition",
        "aws_sagemaker_device",
        "aws_sagemaker_device_fleet",
        "aws_sagemaker_domain",
        "aws_sagemaker_endpoint",
        "aws_sagemaker_endpoint_configuration",
        "aws_sagemaker_feature_group",
        "aws_sagemaker_flow_definition",
        "aws_sagemaker_hub",
        "aws_sagemaker_hub_content_reference",
        "aws_sagemaker_human_task_ui",
        "aws_sagemaker_hyper_parameter_tuning_job",
        "aws_sagemaker_image",
        "aws_sagemaker_image_version",
        "aws_sagemaker_inference_component",
        "aws_sagemaker_labeling_job",
        "aws_sagemaker_mlflow_app",
        "aws_sagemaker_mlflow_tracking_server",
        "aws_sagemaker_model",
        "aws_sagemaker_model_card",
        "aws_sagemaker_model_card_export_job",
        "aws_sagemaker_model_package_group",
        "aws_sagemaker_model_package_group_policy",
        "aws_sagemaker_monitoring_schedule",
        "aws_sagemaker_notebook_instance",
        "aws_sagemaker_notebook_instance_lifecycle_configuration",
        "aws_sagemaker_pipeline",
        "aws_sagemaker_project",
        "aws_sagemaker_servicecatalog_portfolio_status",
        "aws_sagemaker_space",
        "aws_sagemaker_studio_lifecycle_config",
        "aws_sagemaker_training_job",
        "aws_sagemaker_user_profile",
        "aws_sagemaker_workforce",
        "aws_sagemaker_workteam"
      ],
      "Savings Plans": [
        "aws_savingsplans_savings_plan"
      ],
      "EventBridge Scheduler": [
        "aws_scheduler_schedule",
        "aws_scheduler_schedule_group"
      ],
      "EventBridge Schemas": [
        "aws_schemas_discoverer",
        "aws_schemas_registry",
        "aws_schemas_registry_policy",
        "aws_schemas_schema"
      ],
      "Secrets Manager": [
        "aws_secretsmanager_secret",
        "aws_secretsmanager_secret_policy",
        "aws_secretsmanager_secret_rotation",
        "aws_secretsmanager_secret_version",
        "aws_secretsmanager_tag"
      ],
      "Security Hub": [
        "aws_securityhub_account",
        "aws_securityhub_account_v2",
        "aws_securityhub_action_target",
        "aws_securityhub_aggregator_v2",
        "aws_securityhub_automation_rule",
        "aws_securityhub_automation_rule_v2",
        "aws_securityhub_configuration_policy",
        "aws_securityhub_configuration_policy_association",
        "aws_securityhub_connector_v2",
        "aws_securityhub_feature_v2",
        "aws_securityhub_finding_aggregator",
        "aws_securityhub_insight",
        "aws_securityhub_invite_accepter",
        "aws_securityhub_member",
        "aws_securityhub_organization_admin_account",
        "aws_securityhub_organization_configuration",
        "aws_securityhub_product_subscription",
        "aws_securityhub_standards_control",
        "aws_securityhub_standards_control_association",
        "aws_securityhub_standards_subscription"
      ],
      "Security Lake": [
        "aws_securitylake_aws_log_source",
        "aws_securitylake_custom_log_source",
        "aws_securitylake_data_lake",
        "aws_securitylake_subscriber",
        "aws_securitylake_subscriber_notification"
      ],
      "Serverless Application Repository": [
        "aws_serverlessapplicationrepository_cloudformation_stack"
      ],
      "Service Catalog AppRegistry": [
        "aws_servicecatalogappregistry_application",
        "aws_servicecatalogappregistry_attribute_group",
        "aws_servicecatalogappregistry_attribute_group_association"
      ],
      "Service Catalog": [
        "aws_servicecatalog_budget_resource_association",
        "aws_servicecatalog_constraint",
        "aws_servicecatalog_organizations_access",
        "aws_servicecatalog_portfolio",
        "aws_servicecatalog_portfolio_share",
        "aws_servicecatalog_principal_portfolio_association",
        "aws_servicecatalog_product",
        "aws_servicecatalog_product_portfolio_association",
        "aws_servicecatalog_provisioned_product",
        "aws_servicecatalog_provisioning_artifact",
        "aws_servicecatalog_service_action",
        "aws_servicecatalog_tag_option",
        "aws_servicecatalog_tag_option_resource_association"
      ],
      "Cloud Map": [
        "aws_service_discovery_http_namespace",
        "aws_service_discovery_instance",
        "aws_service_discovery_private_dns_namespace",
        "aws_service_discovery_public_dns_namespace",
        "aws_service_discovery_service"
      ],
      "Service Quotas": [
        "aws_servicequotas_auto_management",
        "aws_servicequotas_service_quota",
        "aws_servicequotas_template",
        "aws_servicequotas_template_association"
      ],
      "SES (Simple Email)": [
        "aws_ses_active_receipt_rule_set",
        "aws_ses_configuration_set",
        "aws_ses_domain_dkim",
        "aws_ses_domain_identity",
        "aws_ses_domain_identity_verification",
        "aws_ses_domain_mail_from",
        "aws_ses_email_identity",
        "aws_ses_event_destination",
        "aws_ses_identity_notification_topic",
        "aws_ses_identity_policy",
        "aws_ses_receipt_filter",
        "aws_ses_receipt_rule",
        "aws_ses_receipt_rule_set",
        "aws_ses_template"
      ],
      "SESv2 (Simple Email V2)": [
        "aws_sesv2_account_suppression_attributes",
        "aws_sesv2_account_vdm_attributes",
        "aws_sesv2_configuration_set",
        "aws_sesv2_configuration_set_event_destination",
        "aws_sesv2_contact_list",
        "aws_sesv2_dedicated_ip_assignment",
        "aws_sesv2_dedicated_ip_pool",
        "aws_sesv2_email_identity",
        "aws_sesv2_email_identity_feedback_attributes",
        "aws_sesv2_email_identity_mail_from_attributes",
        "aws_sesv2_email_identity_policy",
        "aws_sesv2_multi_region_endpoint",
        "aws_sesv2_tenant",
        "aws_sesv2_tenant_resource_association"
      ],
      "SFN (Step Functions)": [
        "aws_sfn_activity",
        "aws_sfn_alias",
        "aws_sfn_state_machine"
      ],
      "Shield": [
        "aws_shield_application_layer_automatic_response",
        "aws_shield_drt_access_log_bucket_association",
        "aws_shield_drt_access_role_arn_association",
        "aws_shield_proactive_engagement",
        "aws_shield_protection",
        "aws_shield_protection_group",
        "aws_shield_protection_health_check_association",
        "aws_shield_subscription"
      ],
      "Signer": [
        "aws_signer_signing_job",
        "aws_signer_signing_profile",
        "aws_signer_signing_profile_permission"
      ],
      "SNS (Simple Notification)": [
        "aws_sns_platform_application",
        "aws_sns_sms_preferences",
        "aws_sns_topic",
        "aws_sns_topic_data_protection_policy",
        "aws_sns_topic_policy",
        "aws_sns_topic_subscription"
      ],
      "SQS (Simple Queue)": [
        "aws_sqs_queue",
        "aws_sqs_queue_policy",
        "aws_sqs_queue_redrive_allow_policy",
        "aws_sqs_queue_redrive_policy"
      ],
      "SSM (Systems Manager)": [
        "aws_ssm_activation",
        "aws_ssm_association",
        "aws_ssm_default_patch_baseline",
        "aws_ssm_document",
        "aws_ssm_maintenance_window",
        "aws_ssm_maintenance_window_target",
        "aws_ssm_maintenance_window_task",
        "aws_ssm_parameter",
        "aws_ssm_patch_baseline",
        "aws_ssm_patch_group",
        "aws_ssm_resource_data_sync",
        "aws_ssm_service_setting"
      ],
      "SSM Contacts": [
        "aws_ssmcontacts_contact",
        "aws_ssmcontacts_contact_channel",
        "aws_ssmcontacts_plan",
        "aws_ssmcontacts_rotation"
      ],
      "SSM Incident Manager Incidents": [
        "aws_ssmincidents_replication_set",
        "aws_ssmincidents_response_plan"
      ],
      "SSM Quick Setup": [
        "aws_ssmquicksetup_configuration_manager"
      ],
      "SSO Admin": [
        "aws_ssoadmin_account_assignment",
        "aws_ssoadmin_application",
        "aws_ssoadmin_application_access_scope",
        "aws_ssoadmin_application_assignment",
        "aws_ssoadmin_application_assignment_configuration",
        "aws_ssoadmin_customer_managed_policy_attachment",
        "aws_ssoadmin_customer_managed_policy_attachments_exclusive",
        "aws_ssoadmin_instance_access_control_attributes",
        "aws_ssoadmin_managed_policy_attachment",
        "aws_ssoadmin_managed_policy_attachments_exclusive",
        "aws_ssoadmin_permissions_boundary_attachment",
        "aws_ssoadmin_permission_set",
        "aws_ssoadmin_permission_set_inline_policy",
        "aws_ssoadmin_region",
        "aws_ssoadmin_trusted_token_issuer"
      ],
      "Storage Gateway": [
        "aws_storagegateway_cache",
        "aws_storagegateway_cached_iscsi_volume",
        "aws_storagegateway_file_system_association",
        "aws_storagegateway_gateway",
        "aws_storagegateway_nfs_file_share",
        "aws_storagegateway_smb_file_share",
        "aws_storagegateway_stored_iscsi_volume",
        "aws_storagegateway_tape_pool",
        "aws_storagegateway_upload_buffer",
        "aws_storagegateway_working_storage"
      ],
      "SWF (Simple Workflow)": [
        "aws_swf_domain"
      ],
      "CloudWatch Synthetics": [
        "aws_synthetics_canary",
        "aws_synthetics_group",
        "aws_synthetics_group_association"
      ],
      "Timestream for InfluxDB": [
        "aws_timestreaminfluxdb_db_cluster",
        "aws_timestreaminfluxdb_db_instance"
      ],
      "Timestream Query": [
        "aws_timestreamquery_scheduled_query"
      ],
      "Timestream Write": [
        "aws_timestreamwrite_database",
        "aws_timestreamwrite_table"
      ],
      "Transcribe": [
        "aws_transcribe_language_model",
        "aws_transcribe_medical_vocabulary",
        "aws_transcribe_vocabulary",
        "aws_transcribe_vocabulary_filter"
      ],
      "Transfer Family": [
        "aws_transfer_access",
        "aws_transfer_agreement",
        "aws_transfer_certificate",
        "aws_transfer_connector",
        "aws_transfer_host_key",
        "aws_transfer_profile",
        "aws_transfer_server",
        "aws_transfer_ssh_key",
        "aws_transfer_tag",
        "aws_transfer_user",
        "aws_transfer_web_app",
        "aws_transfer_web_app_customization",
        "aws_transfer_workflow"
      ],
      "User Experience Customization": [
        "aws_uxc_account_customizations"
      ],
      "Verified Access": [
        "aws_verifiedaccess_endpoint",
        "aws_verifiedaccess_group",
        "aws_verifiedaccess_instance",
        "aws_verifiedaccess_instance_logging_configuration",
        "aws_verifiedaccess_instance_trust_provider_attachment",
        "aws_verifiedaccess_trust_provider"
      ],
      "Verified Permissions": [
        "aws_verifiedpermissions_identity_source",
        "aws_verifiedpermissions_policy",
        "aws_verifiedpermissions_policy_store",
        "aws_verifiedpermissions_policy_template",
        "aws_verifiedpermissions_schema"
      ],
      "VPC IPAM (IP Address Manager)": [
        "aws_vpc_ipam",
        "aws_vpc_ipam_organization_admin_account",
        "aws_vpc_ipam_pool",
        "aws_vpc_ipam_pool_cidr",
        "aws_vpc_ipam_pool_cidr_allocation",
        "aws_vpc_ipam_preview_next_cidr",
        "aws_vpc_ipam_resource_discovery",
        "aws_vpc_ipam_resource_discovery_association",
        "aws_vpc_ipam_scope"
      ],
      "VPC Lattice": [
        "aws_vpclattice_access_log_subscription",
        "aws_vpclattice_auth_policy",
        "aws_vpclattice_domain_verification",
        "aws_vpclattice_listener",
        "aws_vpclattice_listener_rule",
        "aws_vpclattice_resource_configuration",
        "aws_vpclattice_resource_gateway",
        "aws_vpclattice_resource_policy",
        "aws_vpclattice_service",
        "aws_vpclattice_service_network",
        "aws_vpclattice_service_network_resource_association",
        "aws_vpclattice_service_network_service_association",
        "aws_vpclattice_service_network_vpc_association",
        "aws_vpclattice_target_group",
        "aws_vpclattice_target_group_attachment"
      ],
      "WAF Classic": [
        "aws_waf_byte_match_set",
        "aws_waf_geo_match_set",
        "aws_waf_ipset",
        "aws_waf_rate_based_rule",
        "aws_waf_regex_match_set",
        "aws_waf_regex_pattern_set",
        "aws_waf_rule",
        "aws_waf_rule_group",
        "aws_waf_size_constraint_set",
        "aws_waf_sql_injection_match_set",
        "aws_waf_web_acl",
        "aws_waf_xss_match_set"
      ],
      "WAF Classic Regional": [
        "aws_wafregional_byte_match_set",
        "aws_wafregional_geo_match_set",
        "aws_wafregional_ipset",
        "aws_wafregional_rate_based_rule",
        "aws_wafregional_regex_match_set",
        "aws_wafregional_regex_pattern_set",
        "aws_wafregional_rule",
        "aws_wafregional_rule_group",
        "aws_wafregional_size_constraint_set",
        "aws_wafregional_sql_injection_match_set",
        "aws_wafregional_web_acl",
        "aws_wafregional_web_acl_association",
        "aws_wafregional_xss_match_set"
      ],
      "WAF": [
        "aws_wafv2_api_key",
        "aws_wafv2_ip_set",
        "aws_wafv2_regex_pattern_set",
        "aws_wafv2_rule_group",
        "aws_wafv2_web_acl",
        "aws_wafv2_web_acl_association",
        "aws_wafv2_web_acl_logging_configuration",
        "aws_wafv2_web_acl_rule",
        "aws_wafv2_web_acl_rule_group_association"
      ],
      "WorkMail": [
        "aws_workmail_default_domain",
        "aws_workmail_domain",
        "aws_workmail_group",
        "aws_workmail_organization",
        "aws_workmail_user"
      ],
      "WorkSpaces": [
        "aws_workspaces_connection_alias",
        "aws_workspaces_directory",
        "aws_workspaces_ip_group",
        "aws_workspaces_pool",
        "aws_workspaces_workspace"
      ],
      "WorkSpaces Web": [
        "aws_workspacesweb_browser_settings",
        "aws_workspacesweb_browser_settings_association",
        "aws_workspacesweb_data_protection_settings",
        "aws_workspacesweb_data_protection_settings_association",
        "aws_workspacesweb_identity_provider",
        "aws_workspacesweb_ip_access_settings",
        "aws_workspacesweb_ip_access_settings_association",
        "aws_workspacesweb_network_settings",
        "aws_workspacesweb_network_settings_association",
        "aws_workspacesweb_portal",
        "aws_workspacesweb_session_logger",
        "aws_workspacesweb_session_logger_association",
        "aws_workspacesweb_trust_store",
        "aws_workspacesweb_trust_store_association",
        "aws_workspacesweb_user_access_logging_settings",
        "aws_workspacesweb_user_access_logging_settings_association",
        "aws_workspacesweb_user_settings",
        "aws_workspacesweb_user_settings_association"
      ],
      "X-Ray": [
        "aws_xray_encryption_config",
        "aws_xray_group",
        "aws_xray_indexing_rule",
        "aws_xray_resource_policy",
        "aws_xray_sampling_rule",
        "aws_xray_trace_segment_destination"
      ]
    }
  },
  "Azure": {
    "provider": "hashicorp/azurerm",
    "version": "4.81.0",
    "services": {
      "AAD B2C": [
        "azurerm_aadb2c_directory"
      ],
      "Active Directory Domain Services": [
        "azurerm_active_directory_domain_service",
        "azurerm_active_directory_domain_service_replica_set",
        "azurerm_active_directory_domain_service_trust"
      ],
      "Security Center": [
        "azurerm_advanced_threat_protection",
        "azurerm_iot_security_device_group",
        "azurerm_iot_security_solution",
        "azurerm_security_center_assessment",
        "azurerm_security_center_assessment_policy",
        "azurerm_security_center_automation",
        "azurerm_security_center_auto_provisioning",
        "azurerm_security_center_contact",
        "azurerm_security_center_server_vulnerability_assessments_setting",
        "azurerm_security_center_server_vulnerability_assessment_virtual_machine",
        "azurerm_security_center_setting",
        "azurerm_security_center_storage_defender",
        "azurerm_security_center_subscription_pricing",
        "azurerm_security_center_workspace"
      ],
      "Advisor": [
        "azurerm_advisor_suppression"
      ],
      "Machine Learning": [
        "azurerm_ai_foundry",
        "azurerm_ai_foundry_project",
        "azurerm_machine_learning_compute_cluster",
        "azurerm_machine_learning_compute_instance",
        "azurerm_machine_learning_datastore_blobstorage",
        "azurerm_machine_learning_datastore_datalake_gen2",
        "azurerm_machine_learning_datastore_fileshare",
        "azurerm_machine_learning_inference_cluster",
        "azurerm_machine_learning_synapse_spark",
        "azurerm_machine_learning_workspace",
        "azurerm_machine_learning_workspace_network_outbound_rule_fqdn",
        "azurerm_machine_learning_workspace_network_outbound_rule_private_endpoint",
        "azurerm_machine_learning_workspace_network_outbound_rule_service_tag"
      ],
      "Cognitive Services": [
        "azurerm_ai_services",
        "azurerm_cognitive_account",
        "azurerm_cognitive_account_connection_account_key",
        "azurerm_cognitive_account_connection_account_managed_identity",
        "azurerm_cognitive_account_connection_api_key",
        "azurerm_cognitive_account_connection_custom_keys",
        "azurerm_cognitive_account_connection_entra_id",
        "azurerm_cognitive_account_customer_managed_key",
        "azurerm_cognitive_account_project",
        "azurerm_cognitive_account_rai_blocklist",
        "azurerm_cognitive_account_rai_policy",
        "azurerm_cognitive_deployment"
      ],
      "Analysis Services": [
        "azurerm_analysis_services_server"
      ],
      "Connections": [
        "azurerm_api_connection"
      ],
      "API Management": [
        "azurerm_api_management",
        "azurerm_api_management_api",
        "azurerm_api_management_api_diagnostic",
        "azurerm_api_management_api_operation",
        "azurerm_api_management_api_operation_policy",
        "azurerm_api_management_api_operation_tag",
        "azurerm_api_management_api_policy",
        "azurerm_api_management_api_release",
        "azurerm_api_management_api_schema",
        "azurerm_api_management_api_tag",
        "azurerm_api_management_api_tag_description",
        "azurerm_api_management_api_version_set",
        "azurerm_api_management_authorization_server",
        "azurerm_api_management_backend",
        "azurerm_api_management_certificate",
        "azurerm_api_management_custom_domain",
        "azurerm_api_management_diagnostic",
        "azurerm_api_management_email_template",
        "azurerm_api_management_gateway",
        "azurerm_api_management_gateway_api",
        "azurerm_api_management_gateway_certificate_authority",
        "azurerm_api_management_gateway_host_name_configuration",
        "azurerm_api_management_global_schema",
        "azurerm_api_management_group",
        "azurerm_api_management_group_user",
        "azurerm_api_management_identity_provider_aad",
        "azurerm_api_management_identity_provider_aadb2c",
        "azurerm_api_management_identity_provider_facebook",
        "azurerm_api_management_identity_provider_google",
        "azurerm_api_management_identity_provider_microsoft",
        "azurerm_api_management_identity_provider_twitter",
        "azurerm_api_management_logger",
        "azurerm_api_management_named_value",
        "azurerm_api_management_notification_recipient_email",
        "azurerm_api_management_notification_recipient_user",
        "azurerm_api_management_openid_connect_provider",
        "azurerm_api_management_policy",
        "azurerm_api_management_policy_fragment",
        "azurerm_api_management_product",
        "azurerm_api_management_product_api",
        "azurerm_api_management_product_group",
        "azurerm_api_management_product_policy",
        "azurerm_api_management_product_tag",
        "azurerm_api_management_redis_cache",
        "azurerm_api_management_standalone_gateway",
        "azurerm_api_management_subscription",
        "azurerm_api_management_tag",
        "azurerm_api_management_user",
        "azurerm_api_management_workspace",
        "azurerm_api_management_workspace_api_version_set",
        "azurerm_api_management_workspace_certificate",
        "azurerm_api_management_workspace_named_value",
        "azurerm_api_management_workspace_policy",
        "azurerm_api_management_workspace_policy_fragment"
      ],
      "App Configuration": [
        "azurerm_app_configuration",
        "azurerm_app_configuration_feature",
        "azurerm_app_configuration_key"
      ],
      "Network": [
        "azurerm_application_gateway",
        "azurerm_application_security_group",
        "azurerm_bastion_host",
        "azurerm_custom_ip_prefix",
        "azurerm_express_route_circuit",
        "azurerm_express_route_circuit_authorization",
        "azurerm_express_route_circuit_connection",
        "azurerm_express_route_circuit_peering",
        "azurerm_express_route_connection",
        "azurerm_express_route_gateway",
        "azurerm_express_route_port",
        "azurerm_express_route_port_authorization",
        "azurerm_firewall",
        "azurerm_firewall_application_rule_collection",
        "azurerm_firewall_nat_rule_collection",
        "azurerm_firewall_network_rule_collection",
        "azurerm_firewall_policy",
        "azurerm_firewall_policy_rule_collection_group",
        "azurerm_frontdoor",
        "azurerm_frontdoor_custom_https_configuration",
        "azurerm_frontdoor_firewall_policy",
        "azurerm_frontdoor_rules_engine",
        "azurerm_ip_group",
        "azurerm_ip_group_cidr",
        "azurerm_local_network_gateway",
        "azurerm_nat_gateway",
        "azurerm_nat_gateway_public_ip_association",
        "azurerm_nat_gateway_public_ip_prefix_association",
        "azurerm_network_connection_monitor",
        "azurerm_network_ddos_protection_plan",
        "azurerm_network_interface",
        "azurerm_network_interface_application_gateway_backend_address_pool_association",
        "azurerm_network_interface_application_security_group_association",
        "azurerm_network_interface_backend_address_pool_association",
        "azurerm_network_interface_nat_rule_association",
        "azurerm_network_interface_security_group_association",
        "azurerm_network_manager",
        "azurerm_network_manager_admin_rule",
        "azurerm_network_manager_admin_rule_collection",
        "azurerm_network_manager_connectivity_configuration",
        "azurerm_network_manager_deployment",
        "azurerm_network_manager_ipam_pool",
        "azurerm_network_manager_ipam_pool_static_cidr",
        "azurerm_network_manager_management_group_connection",
        "azurerm_network_manager_network_group",
        "azurerm_network_manager_routing_configuration",
        "azurerm_network_manager_routing_rule",
        "azurerm_network_manager_routing_rule_collection",
        "azurerm_network_manager_scope_connection",
        "azurerm_network_manager_security_admin_configuration",
        "azurerm_network_manager_static_member",
        "azurerm_network_manager_subscription_connection",
        "azurerm_network_manager_verifier_workspace",
        "azurerm_network_manager_verifier_workspace_reachability_analysis_intent",
        "azurerm_network_profile",
        "azurerm_network_security_group",
        "azurerm_network_security_perimeter",
        "azurerm_network_security_perimeter_access_rule",
        "azurerm_network_security_perimeter_association",
        "azurerm_network_security_perimeter_profile",
        "azurerm_network_security_rule",
        "azurerm_network_watcher",
        "azurerm_network_watcher_flow_log",
        "azurerm_point_to_site_vpn_gateway",
        "azurerm_private_endpoint",
        "azurerm_private_endpoint_application_security_group_association",
        "azurerm_private_link_service",
        "azurerm_public_ip",
        "azurerm_public_ip_prefix",
        "azurerm_route",
        "azurerm_route_filter",
        "azurerm_route_map",
        "azurerm_route_server",
        "azurerm_route_server_bgp_connection",
        "azurerm_route_table",
        "azurerm_subnet",
        "azurerm_subnet_nat_gateway_association",
        "azurerm_subnet_network_security_group_association",
        "azurerm_subnet_route_table_association",
        "azurerm_subnet_service_endpoint_storage_policy",
        "azurerm_traffic_manager_azure_endpoint",
        "azurerm_traffic_manager_external_endpoint",
        "azurerm_traffic_manager_nested_endpoint",
        "azurerm_traffic_manager_profile",
        "azurerm_virtual_hub",
        "azurerm_virtual_hub_bgp_connection",
        "azurerm_virtual_hub_connection",
        "azurerm_virtual_hub_ip",
        "azurerm_virtual_hub_route_table",
        "azurerm_virtual_hub_route_table_route",
        "azurerm_virtual_hub_routing_intent",
        "azurerm_virtual_hub_security_partner_provider",
        "azurerm_virtual_machine_packet_capture",
        "azurerm_virtual_machine_scale_set_packet_capture",
        "azurerm_virtual_network",
        "azurerm_virtual_network_dns_servers",
        "azurerm_virtual_network_gateway",
        "azurerm_virtual_network_gateway_connection",
        "azurerm_virtual_network_gateway_nat_rule",
        "azurerm_virtual_network_peering",
        "azurerm_virtual_wan",
        "azurerm_vpn_gateway",
        "azurerm_vpn_gateway_connection",
        "azurerm_vpn_gateway_nat_rule",
        "azurerm_vpn_server_configuration",
        "azurerm_vpn_server_configuration_policy_group",
        "azurerm_vpn_site",
        "azurerm_web_application_firewall_policy"
      ],
      "Application Insights": [
        "azurerm_application_insights",
        "azurerm_application_insights_analytics_item",
        "azurerm_application_insights_api_key",
        "azurerm_application_insights_smart_detection_rule",
        "azurerm_application_insights_standard_web_test",
        "azurerm_application_insights_web_test",
        "azurerm_application_insights_workbook",
        "azurerm_application_insights_workbook_template"
      ],
      "Service Networking": [
        "azurerm_application_load_balancer",
        "azurerm_application_load_balancer_frontend",
        "azurerm_application_load_balancer_security_policy",
        "azurerm_application_load_balancer_subnet_association"
      ],
      "App Service (Web Apps)": [
        "azurerm_app_service",
        "azurerm_app_service_active_slot",
        "azurerm_app_service_certificate",
        "azurerm_app_service_certificate_binding",
        "azurerm_app_service_certificate_order",
        "azurerm_app_service_connection",
        "azurerm_app_service_custom_hostname_binding",
        "azurerm_app_service_environment_v3",
        "azurerm_app_service_hybrid_connection",
        "azurerm_app_service_managed_certificate",
        "azurerm_app_service_plan",
        "azurerm_app_service_public_certificate",
        "azurerm_app_service_slot",
        "azurerm_app_service_slot_custom_hostname_binding",
        "azurerm_app_service_slot_virtual_network_swift_connection",
        "azurerm_app_service_source_control",
        "azurerm_app_service_source_control_slot",
        "azurerm_app_service_source_control_token",
        "azurerm_app_service_virtual_network_swift_connection",
        "azurerm_function_app",
        "azurerm_function_app_active_slot",
        "azurerm_function_app_connection",
        "azurerm_function_app_flex_consumption",
        "azurerm_function_app_function",
        "azurerm_function_app_hybrid_connection",
        "azurerm_function_app_slot",
        "azurerm_linux_function_app",
        "azurerm_linux_function_app_slot",
        "azurerm_linux_web_app",
        "azurerm_linux_web_app_slot",
        "azurerm_service_plan",
        "azurerm_source_control_token",
        "azurerm_static_site",
        "azurerm_static_site_custom_domain",
        "azurerm_static_web_app",
        "azurerm_static_web_app_custom_domain",
        "azurerm_static_web_app_function_app_registration",
        "azurerm_web_app_active_slot",
        "azurerm_web_app_hybrid_connection",
        "azurerm_windows_function_app",
        "azurerm_windows_function_app_slot",
        "azurerm_windows_web_app",
        "azurerm_windows_web_app_slot"
      ],
      "ArcKubernetes": [
        "azurerm_arc_kubernetes_cluster",
        "azurerm_arc_kubernetes_cluster_extension",
        "azurerm_arc_kubernetes_flux_configuration",
        "azurerm_arc_kubernetes_provisioned_cluster"
      ],
      "Hybrid Compute": [
        "azurerm_arc_machine",
        "azurerm_arc_machine_extension",
        "azurerm_arc_private_link_scope"
      ],
      "Automanage": [
        "azurerm_arc_machine_automanage_configuration_assignment",
        "azurerm_automanage_configuration",
        "azurerm_virtual_machine_automanage_configuration_assignment"
      ],
      "Arc Resource Bridge": [
        "azurerm_arc_resource_bridge_appliance"
      ],
      "Attestation": [
        "azurerm_attestation_provider"
      ],
      "Automation": [
        "azurerm_automation_account",
        "azurerm_automation_certificate",
        "azurerm_automation_connection",
        "azurerm_automation_connection_certificate",
        "azurerm_automation_connection_classic_certificate",
        "azurerm_automation_connection_service_principal",
        "azurerm_automation_connection_type",
        "azurerm_automation_credential",
        "azurerm_automation_dsc_configuration",
        "azurerm_automation_dsc_nodeconfiguration",
        "azurerm_automation_hybrid_runbook_worker",
        "azurerm_automation_hybrid_runbook_worker_group",
        "azurerm_automation_job_schedule",
        "azurerm_automation_module",
        "azurerm_automation_powershell72_module",
        "azurerm_automation_python3_package",
        "azurerm_automation_runbook",
        "azurerm_automation_runtime_environment",
        "azurerm_automation_runtime_environment_package",
        "azurerm_automation_schedule",
        "azurerm_automation_software_update_configuration",
        "azurerm_automation_source_control",
        "azurerm_automation_variable_bool",
        "azurerm_automation_variable_datetime",
        "azurerm_automation_variable_int",
        "azurerm_automation_variable_object",
        "azurerm_automation_variable_string",
        "azurerm_automation_watcher",
        "azurerm_automation_webhook"
      ],
      "Compute": [
        "azurerm_availability_set",
        "azurerm_capacity_reservation",
        "azurerm_capacity_reservation_group",
        "azurerm_dedicated_host",
        "azurerm_dedicated_host_group",
        "azurerm_disk_access",
        "azurerm_disk_encryption_set",
        "azurerm_gallery_application",
        "azurerm_gallery_application_version",
        "azurerm_image",
        "azurerm_linux_virtual_machine",
        "azurerm_linux_virtual_machine_scale_set",
        "azurerm_managed_disk",
        "azurerm_managed_disk_sas_token",
        "azurerm_marketplace_agreement",
        "azurerm_orchestrated_virtual_machine_scale_set",
        "azurerm_proximity_placement_group",
        "azurerm_shared_image",
        "azurerm_shared_image_gallery",
        "azurerm_shared_image_version",
        "azurerm_snapshot",
        "azurerm_ssh_public_key",
        "azurerm_virtual_machine",
        "azurerm_virtual_machine_data_disk_attachment",
        "azurerm_virtual_machine_extension",
        "azurerm_virtual_machine_gallery_application_assignment",
        "azurerm_virtual_machine_implicit_data_disk_from_source",
        "azurerm_virtual_machine_restore_point",
        "azurerm_virtual_machine_restore_point_collection",
        "azurerm_virtual_machine_run_command",
        "azurerm_virtual_machine_scale_set",
        "azurerm_virtual_machine_scale_set_extension",
        "azurerm_virtual_machine_scale_set_standby_pool",
        "azurerm_windows_virtual_machine",
        "azurerm_windows_virtual_machine_scale_set"
      ],
      "Recovery Services": [
        "azurerm_backup_container_storage_account",
        "azurerm_backup_policy_file_share",
        "azurerm_backup_policy_vm",
        "azurerm_backup_policy_vm_workload",
        "azurerm_backup_protected_file_share",
        "azurerm_backup_protected_vm",
        "azurerm_recovery_services_vault",
        "azurerm_recovery_services_vault_resource_guard_association",
        "azurerm_site_recovery_fabric",
        "azurerm_site_recovery_hyperv_network_mapping",
        "azurerm_site_recovery_hyperv_replication_policy",
        "azurerm_site_recovery_hyperv_replication_policy_association",
        "azurerm_site_recovery_network_mapping",
        "azurerm_site_recovery_protection_container",
        "azurerm_site_recovery_protection_container_mapping",
        "azurerm_site_recovery_replicated_vm",
        "azurerm_site_recovery_replication_policy",
        "azurerm_site_recovery_replication_recovery_plan",
        "azurerm_site_recovery_services_vault_hyperv_site",
        "azurerm_site_recovery_vmware_replicated_vm",
        "azurerm_site_recovery_vmware_replication_policy",
        "azurerm_site_recovery_vmware_replication_policy_association"
      ],
      "Batch": [
        "azurerm_batch_account",
        "azurerm_batch_application",
        "azurerm_batch_certificate",
        "azurerm_batch_job",
        "azurerm_batch_pool"
      ],
      "Cost Management": [
        "azurerm_billing_account_cost_management_export",
        "azurerm_cost_anomaly_alert",
        "azurerm_cost_management_scheduled_action",
        "azurerm_resource_group_cost_management_export",
        "azurerm_resource_group_cost_management_view",
        "azurerm_subscription_cost_management_export",
        "azurerm_subscription_cost_management_view"
      ],
      "Blueprints": [
        "azurerm_blueprint_assignment"
      ],
      "Bot": [
        "azurerm_bot_channel_alexa",
        "azurerm_bot_channel_directline",
        "azurerm_bot_channel_direct_line_speech",
        "azurerm_bot_channel_email",
        "azurerm_bot_channel_facebook",
        "azurerm_bot_channel_line",
        "azurerm_bot_channel_ms_teams",
        "azurerm_bot_channel_slack",
        "azurerm_bot_channel_sms",
        "azurerm_bot_channels_registration",
        "azurerm_bot_channel_web_chat",
        "azurerm_bot_connection",
        "azurerm_bot_service_azure_bot",
        "azurerm_bot_web_app",
        "azurerm_healthbot"
      ],
      "CDN": [
        "azurerm_cdn_endpoint",
        "azurerm_cdn_endpoint_custom_domain",
        "azurerm_cdn_frontdoor_batch_rule_set",
        "azurerm_cdn_frontdoor_custom_domain",
        "azurerm_cdn_frontdoor_custom_domain_association",
        "azurerm_cdn_frontdoor_endpoint",
        "azurerm_cdn_frontdoor_firewall_policy",
        "azurerm_cdn_frontdoor_origin",
        "azurerm_cdn_frontdoor_origin_group",
        "azurerm_cdn_frontdoor_profile",
        "azurerm_cdn_frontdoor_route",
        "azurerm_cdn_frontdoor_rule",
        "azurerm_cdn_frontdoor_rule_set",
        "azurerm_cdn_frontdoor_secret",
        "azurerm_cdn_frontdoor_security_policy",
        "azurerm_cdn_profile"
      ],
      "Chaos Studio": [
        "azurerm_chaos_studio_capability",
        "azurerm_chaos_studio_experiment",
        "azurerm_chaos_studio_target"
      ],
      "Communication": [
        "azurerm_communication_service",
        "azurerm_communication_service_email_domain_association",
        "azurerm_email_communication_service",
        "azurerm_email_communication_service_domain",
        "azurerm_email_communication_service_domain_sender_username"
      ],
      "Confidential Ledger": [
        "azurerm_confidential_ledger"
      ],
      "Consumption": [
        "azurerm_consumption_budget_management_group",
        "azurerm_consumption_budget_resource_group",
        "azurerm_consumption_budget_subscription"
      ],
      "Container Apps": [
        "azurerm_container_app",
        "azurerm_container_app_custom_domain",
        "azurerm_container_app_environment",
        "azurerm_container_app_environment_certificate",
        "azurerm_container_app_environment_custom_domain",
        "azurerm_container_app_environment_dapr_component",
        "azurerm_container_app_environment_managed_certificate",
        "azurerm_container_app_environment_storage",
        "azurerm_container_app_job"
      ],
      "Container": [
        "azurerm_container_connected_registry",
        "azurerm_container_group",
        "azurerm_container_registry",
        "azurerm_container_registry_agent_pool",
        "azurerm_container_registry_cache_rule",
        "azurerm_container_registry_credential_set",
        "azurerm_container_registry_scope_map",
        "azurerm_container_registry_task",
        "azurerm_container_registry_task_schedule_run_now",
        "azurerm_container_registry_token",
        "azurerm_container_registry_token_password",
        "azurerm_container_registry_webhook",
        "azurerm_kubernetes_automatic_cluster",
        "azurerm_kubernetes_cluster",
        "azurerm_kubernetes_cluster_deployment_safeguard",
        "azurerm_kubernetes_cluster_extension",
        "azurerm_kubernetes_cluster_node_pool",
        "azurerm_kubernetes_cluster_trusted_access_role_binding",
        "azurerm_kubernetes_fleet_manager",
        "azurerm_kubernetes_fleet_member",
        "azurerm_kubernetes_fleet_update_run",
        "azurerm_kubernetes_fleet_update_strategy",
        "azurerm_kubernetes_flux_configuration"
      ],
      "CosmosDB (DocumentDB)": [
        "azurerm_cosmosdb_account",
        "azurerm_cosmosdb_cassandra_cluster",
        "azurerm_cosmosdb_cassandra_datacenter",
        "azurerm_cosmosdb_cassandra_keyspace",
        "azurerm_cosmosdb_cassandra_table",
        "azurerm_cosmosdb_gremlin_database",
        "azurerm_cosmosdb_gremlin_graph",
        "azurerm_cosmosdb_mongo_collection",
        "azurerm_cosmosdb_mongo_database",
        "azurerm_cosmosdb_mongo_role_definition",
        "azurerm_cosmosdb_mongo_user_definition",
        "azurerm_cosmosdb_postgresql_cluster",
        "azurerm_cosmosdb_postgresql_coordinator_configuration",
        "azurerm_cosmosdb_postgresql_firewall_rule",
        "azurerm_cosmosdb_postgresql_node_configuration",
        "azurerm_cosmosdb_postgresql_role",
        "azurerm_cosmosdb_sql_container",
        "azurerm_cosmosdb_sql_database",
        "azurerm_cosmosdb_sql_dedicated_gateway",
        "azurerm_cosmosdb_sql_function",
        "azurerm_cosmosdb_sql_role_assignment",
        "azurerm_cosmosdb_sql_role_definition",
        "azurerm_cosmosdb_sql_stored_procedure",
        "azurerm_cosmosdb_sql_trigger",
        "azurerm_cosmosdb_table"
      ],
      "Custom Providers": [
        "azurerm_custom_provider"
      ],
      "Dashboard": [
        "azurerm_dashboard_grafana",
        "azurerm_dashboard_grafana_managed_private_endpoint"
      ],
      "Database Migration": [
        "azurerm_database_migration_project",
        "azurerm_database_migration_service"
      ],
      "Databox Edge": [
        "azurerm_databox_edge_device"
      ],
      "Databricks": [
        "azurerm_databricks_access_connector",
        "azurerm_databricks_virtual_network_peering",
        "azurerm_databricks_workspace",
        "azurerm_databricks_workspace_root_dbfs_customer_managed_key"
      ],
      "Datadog": [
        "azurerm_datadog_monitor",
        "azurerm_datadog_monitor_sso_configuration",
        "azurerm_datadog_monitor_tag_rule"
      ],
      "Data Factory": [
        "azurerm_data_factory",
        "azurerm_data_factory_credential_service_principal",
        "azurerm_data_factory_credential_user_managed_identity",
        "azurerm_data_factory_custom_dataset",
        "azurerm_data_factory_customer_managed_key",
        "azurerm_data_factory_data_flow",
        "azurerm_data_factory_dataset_azure_blob",
        "azurerm_data_factory_dataset_azure_sql_table",
        "azurerm_data_factory_dataset_binary",
        "azurerm_data_factory_dataset_cosmosdb_sqlapi",
        "azurerm_data_factory_dataset_delimited_text",
        "azurerm_data_factory_dataset_http",
        "azurerm_data_factory_dataset_json",
        "azurerm_data_factory_dataset_mysql",
        "azurerm_data_factory_dataset_parquet",
        "azurerm_data_factory_dataset_postgresql",
        "azurerm_data_factory_dataset_snowflake",
        "azurerm_data_factory_dataset_sql_server_table",
        "azurerm_data_factory_flowlet_data_flow",
        "azurerm_data_factory_integration_runtime_azure",
        "azurerm_data_factory_integration_runtime_azure_ssis",
        "azurerm_data_factory_integration_runtime_self_hosted",
        "azurerm_data_factory_linked_custom_service",
        "azurerm_data_factory_linked_service_azure_blob_storage",
        "azurerm_data_factory_linked_service_azure_databricks",
        "azurerm_data_factory_linked_service_azure_file_storage",
        "azurerm_data_factory_linked_service_azure_function",
        "azurerm_data_factory_linked_service_azure_search",
        "azurerm_data_factory_linked_service_azure_sql_database",
        "azurerm_data_factory_linked_service_azure_table_storage",
        "azurerm_data_factory_linked_service_cosmosdb",
        "azurerm_data_factory_linked_service_cosmosdb_mongoapi",
        "azurerm_data_factory_linked_service_data_lake_storage_gen2",
        "azurerm_data_factory_linked_service_key_vault",
        "azurerm_data_factory_linked_service_kusto",
        "azurerm_data_factory_linked_service_mysql",
        "azurerm_data_factory_linked_service_odata",
        "azurerm_data_factory_linked_service_odbc",
        "azurerm_data_factory_linked_service_postgresql",
        "azurerm_data_factory_linked_service_sftp",
        "azurerm_data_factory_linked_service_snowflake",
        "azurerm_data_factory_linked_service_sql_managed_instance",
        "azurerm_data_factory_linked_service_sql_server",
        "azurerm_data_factory_linked_service_synapse",
        "azurerm_data_factory_linked_service_web",
        "azurerm_data_factory_managed_private_endpoint",
        "azurerm_data_factory_pipeline",
        "azurerm_data_factory_trigger_blob_event",
        "azurerm_data_factory_trigger_custom_event",
        "azurerm_data_factory_trigger_schedule",
        "azurerm_data_factory_trigger_tumbling_window"
      ],
      "DataProtection": [
        "azurerm_data_protection_backup_instance_blob_storage",
        "azurerm_data_protection_backup_instance_data_lake_storage",
        "azurerm_data_protection_backup_instance_disk",
        "azurerm_data_protection_backup_instance_kubernetes_cluster",
        "azurerm_data_protection_backup_instance_mysql_flexible_server",
        "azurerm_data_protection_backup_instance_postgresql",
        "azurerm_data_protection_backup_instance_postgresql_flexible_server",
        "azurerm_data_protection_backup_policy_blob_storage",
        "azurerm_data_protection_backup_policy_data_lake_storage",
        "azurerm_data_protection_backup_policy_disk",
        "azurerm_data_protection_backup_policy_kubernetes_cluster",
        "azurerm_data_protection_backup_policy_mysql_flexible_server",
        "azurerm_data_protection_backup_policy_postgresql",
        "azurerm_data_protection_backup_policy_postgresql_flexible_server",
        "azurerm_data_protection_backup_vault",
        "azurerm_data_protection_backup_vault_customer_managed_key",
        "azurerm_data_protection_resource_guard"
      ],
      "Data Share": [
        "azurerm_data_share",
        "azurerm_data_share_account",
        "azurerm_data_share_dataset_blob_storage",
        "azurerm_data_share_dataset_data_lake_gen2",
        "azurerm_data_share_dataset_kusto_cluster",
        "azurerm_data_share_dataset_kusto_database"
      ],
      "Hardware Security Module": [
        "azurerm_dedicated_hardware_security_module"
      ],
      "Dev Center": [
        "azurerm_dev_center",
        "azurerm_dev_center_attached_network",
        "azurerm_dev_center_catalog",
        "azurerm_dev_center_dev_box_definition",
        "azurerm_dev_center_environment_type",
        "azurerm_dev_center_gallery",
        "azurerm_dev_center_network_connection",
        "azurerm_dev_center_project",
        "azurerm_dev_center_project_environment_type",
        "azurerm_dev_center_project_pool"
      ],
      "Dev Test": [
        "azurerm_dev_test_global_vm_shutdown_schedule",
        "azurerm_dev_test_lab",
        "azurerm_dev_test_linux_virtual_machine",
        "azurerm_dev_test_policy",
        "azurerm_dev_test_schedule",
        "azurerm_dev_test_virtual_network",
        "azurerm_dev_test_windows_virtual_machine"
      ],
      "Digital Twins": [
        "azurerm_digital_twins_endpoint_eventgrid",
        "azurerm_digital_twins_endpoint_eventhub",
        "azurerm_digital_twins_endpoint_servicebus",
        "azurerm_digital_twins_instance",
        "azurerm_digital_twins_time_series_database_connection"
      ],
      "DNS": [
        "azurerm_dns_aaaa_record",
        "azurerm_dns_a_record",
        "azurerm_dns_caa_record",
        "azurerm_dns_cname_record",
        "azurerm_dns_mx_record",
        "azurerm_dns_ns_record",
        "azurerm_dns_ptr_record",
        "azurerm_dns_srv_record",
        "azurerm_dns_txt_record",
        "azurerm_dns_zone"
      ],
      "Dynatrace": [
        "azurerm_dynatrace_monitor",
        "azurerm_dynatrace_tag_rules"
      ],
      "Elastic": [
        "azurerm_elastic_cloud_elasticsearch"
      ],
      "Elastic SAN": [
        "azurerm_elastic_san",
        "azurerm_elastic_san_volume",
        "azurerm_elastic_san_volume_group"
      ],
      "Messaging": [
        "azurerm_eventgrid_domain",
        "azurerm_eventgrid_domain_topic",
        "azurerm_eventgrid_event_subscription",
        "azurerm_eventgrid_namespace",
        "azurerm_eventgrid_namespace_topic",
        "azurerm_eventgrid_partner_configuration",
        "azurerm_eventgrid_partner_namespace",
        "azurerm_eventgrid_partner_registration",
        "azurerm_eventgrid_system_topic",
        "azurerm_eventgrid_system_topic_event_subscription",
        "azurerm_eventgrid_topic",
        "azurerm_eventhub",
        "azurerm_eventhub_authorization_rule",
        "azurerm_eventhub_cluster",
        "azurerm_eventhub_consumer_group",
        "azurerm_eventhub_namespace",
        "azurerm_eventhub_namespace_authorization_rule",
        "azurerm_eventhub_namespace_customer_managed_key",
        "azurerm_eventhub_namespace_disaster_recovery_config",
        "azurerm_eventhub_namespace_schema_group",
        "azurerm_notification_hub",
        "azurerm_notification_hub_authorization_rule",
        "azurerm_notification_hub_namespace",
        "azurerm_relay_hybrid_connection",
        "azurerm_relay_hybrid_connection_authorization_rule",
        "azurerm_relay_namespace",
        "azurerm_relay_namespace_authorization_rule",
        "azurerm_servicebus_namespace",
        "azurerm_servicebus_namespace_authorization_rule",
        "azurerm_servicebus_namespace_customer_managed_key",
        "azurerm_servicebus_namespace_disaster_recovery_config",
        "azurerm_servicebus_queue",
        "azurerm_servicebus_queue_authorization_rule",
        "azurerm_servicebus_subscription",
        "azurerm_servicebus_subscription_rule",
        "azurerm_servicebus_topic",
        "azurerm_servicebus_topic_authorization_rule",
        "azurerm_signalr_service",
        "azurerm_signalr_service_custom_certificate",
        "azurerm_signalr_service_custom_domain",
        "azurerm_signalr_service_network_acl",
        "azurerm_signalr_shared_private_link_resource",
        "azurerm_web_pubsub",
        "azurerm_web_pubsub_custom_certificate",
        "azurerm_web_pubsub_custom_domain",
        "azurerm_web_pubsub_hub",
        "azurerm_web_pubsub_network_acl",
        "azurerm_web_pubsub_shared_private_link_resource",
        "azurerm_web_pubsub_socketio"
      ],
      "Extended Location": [
        "azurerm_extended_location_custom_location"
      ],
      "Fabric": [
        "azurerm_fabric_capacity"
      ],
      "Authorization": [
        "azurerm_federated_identity_credential",
        "azurerm_marketplace_role_assignment",
        "azurerm_pim_active_role_assignment",
        "azurerm_pim_eligible_role_assignment",
        "azurerm_role_assignment",
        "azurerm_role_definition",
        "azurerm_role_management_policy",
        "azurerm_user_assigned_identity"
      ],
      "Fluid Relay": [
        "azurerm_fluid_relay_server"
      ],
      "Graph Services": [
        "azurerm_graph_services_account"
      ],
      "HDInsight": [
        "azurerm_hdinsight_hadoop_cluster",
        "azurerm_hdinsight_hbase_cluster",
        "azurerm_hdinsight_interactive_query_cluster",
        "azurerm_hdinsight_kafka_cluster",
        "azurerm_hdinsight_spark_cluster"
      ],
      "Healthcare": [
        "azurerm_healthcare_dicom_service",
        "azurerm_healthcare_fhir_service",
        "azurerm_healthcare_medtech_service",
        "azurerm_healthcare_medtech_service_fhir_destination",
        "azurerm_healthcare_service",
        "azurerm_healthcare_workspace"
      ],
      "Storage": [
        "azurerm_hpc_cache",
        "azurerm_hpc_cache_access_policy",
        "azurerm_hpc_cache_blob_nfs_target",
        "azurerm_hpc_cache_blob_target",
        "azurerm_hpc_cache_nfs_target",
        "azurerm_storage_account",
        "azurerm_storage_account_customer_managed_key",
        "azurerm_storage_account_local_user",
        "azurerm_storage_account_network_rules",
        "azurerm_storage_account_queue_properties",
        "azurerm_storage_account_static_website",
        "azurerm_storage_account_table_properties",
        "azurerm_storage_blob",
        "azurerm_storage_blob_inventory_policy",
        "azurerm_storage_container",
        "azurerm_storage_container_immutability_policy",
        "azurerm_storage_data_lake_gen2_filesystem",
        "azurerm_storage_data_lake_gen2_path",
        "azurerm_storage_encryption_scope",
        "azurerm_storage_management_policy",
        "azurerm_storage_object_replication",
        "azurerm_storage_queue",
        "azurerm_storage_share",
        "azurerm_storage_share_directory",
        "azurerm_storage_share_file",
        "azurerm_storage_sync",
        "azurerm_storage_sync_cloud_endpoint",
        "azurerm_storage_sync_group",
        "azurerm_storage_sync_server_endpoint",
        "azurerm_storage_table",
        "azurerm_storage_table_entity"
      ],
      "IoT Central": [
        "azurerm_iotcentral_application",
        "azurerm_iotcentral_application_network_rule_set",
        "azurerm_iotcentral_organization"
      ],
      "IoT Hub": [
        "azurerm_iothub",
        "azurerm_iothub_certificate",
        "azurerm_iothub_consumer_group",
        "azurerm_iothub_device_update_account",
        "azurerm_iothub_device_update_instance",
        "azurerm_iothub_dps",
        "azurerm_iothub_dps_certificate",
        "azurerm_iothub_dps_shared_access_policy",
        "azurerm_iothub_endpoint_cosmosdb_account",
        "azurerm_iothub_endpoint_eventhub",
        "azurerm_iothub_endpoint_servicebus_queue",
        "azurerm_iothub_endpoint_servicebus_topic",
        "azurerm_iothub_endpoint_storage_container",
        "azurerm_iothub_enrichment",
        "azurerm_iothub_fallback_route",
        "azurerm_iothub_file_upload",
        "azurerm_iothub_route",
        "azurerm_iothub_shared_access_policy"
      ],
      "Key Vault": [
        "azurerm_key_vault",
        "azurerm_key_vault_access_policy",
        "azurerm_key_vault_certificate",
        "azurerm_key_vault_certificate_contacts",
        "azurerm_key_vault_certificate_issuer",
        "azurerm_key_vault_key",
        "azurerm_key_vault_managed_hardware_security_module",
        "azurerm_key_vault_managed_hardware_security_module_key",
        "azurerm_key_vault_managed_hardware_security_module_key_rotation_policy",
        "azurerm_key_vault_managed_hardware_security_module_role_assignment",
        "azurerm_key_vault_managed_hardware_security_module_role_definition",
        "azurerm_key_vault_managed_storage_account",
        "azurerm_key_vault_managed_storage_account_sas_token_definition",
        "azurerm_key_vault_secret"
      ],
      "Data Explorer": [
        "azurerm_kusto_attached_database_configuration",
        "azurerm_kusto_cluster",
        "azurerm_kusto_cluster_customer_managed_key",
        "azurerm_kusto_cluster_managed_private_endpoint",
        "azurerm_kusto_cluster_principal_assignment",
        "azurerm_kusto_cosmosdb_data_connection",
        "azurerm_kusto_database",
        "azurerm_kusto_database_principal_assignment",
        "azurerm_kusto_eventgrid_data_connection",
        "azurerm_kusto_eventhub_data_connection",
        "azurerm_kusto_iothub_data_connection",
        "azurerm_kusto_script"
      ],
      "Load Balancer": [
        "azurerm_lb",
        "azurerm_lb_backend_address_pool",
        "azurerm_lb_backend_address_pool_address",
        "azurerm_lb_nat_pool",
        "azurerm_lb_nat_rule",
        "azurerm_lb_outbound_rule",
        "azurerm_lb_probe",
        "azurerm_lb_rule"
      ],
      "Lighthouse": [
        "azurerm_lighthouse_assignment",
        "azurerm_lighthouse_definition"
      ],
      "Load Test": [
        "azurerm_load_test"
      ],
      "Log Analytics": [
        "azurerm_log_analytics_cluster",
        "azurerm_log_analytics_cluster_customer_managed_key",
        "azurerm_log_analytics_data_export_rule",
        "azurerm_log_analytics_datasource_windows_event",
        "azurerm_log_analytics_datasource_windows_performance_counter",
        "azurerm_log_analytics_linked_service",
        "azurerm_log_analytics_linked_storage_account",
        "azurerm_log_analytics_query_pack",
        "azurerm_log_analytics_query_pack_query",
        "azurerm_log_analytics_saved_search",
        "azurerm_log_analytics_solution",
        "azurerm_log_analytics_storage_insights",
        "azurerm_log_analytics_workspace",
        "azurerm_log_analytics_workspace_table",
        "azurerm_log_analytics_workspace_table_custom_log",
        "azurerm_log_analytics_workspace_table_microsoft"
      ],
      "Logic App": [
        "azurerm_logic_app_action_custom",
        "azurerm_logic_app_action_http",
        "azurerm_logic_app_integration_account",
        "azurerm_logic_app_integration_account_agreement",
        "azurerm_logic_app_integration_account_assembly",
        "azurerm_logic_app_integration_account_batch_configuration",
        "azurerm_logic_app_integration_account_certificate",
        "azurerm_logic_app_integration_account_map",
        "azurerm_logic_app_integration_account_partner",
        "azurerm_logic_app_integration_account_schema",
        "azurerm_logic_app_integration_account_session",
        "azurerm_logic_app_standard",
        "azurerm_logic_app_trigger_custom",
        "azurerm_logic_app_trigger_http_request",
        "azurerm_logic_app_trigger_recurrence",
        "azurerm_logic_app_workflow"
      ],
      "Maintenance": [
        "azurerm_maintenance_assignment_dedicated_host",
        "azurerm_maintenance_assignment_dynamic_scope",
        "azurerm_maintenance_assignment_virtual_machine",
        "azurerm_maintenance_assignment_virtual_machine_scale_set",
        "azurerm_maintenance_configuration"
      ],
      "Managed Applications": [
        "azurerm_managed_application",
        "azurerm_managed_application_definition"
      ],
      "Managed DevOps Pools": [
        "azurerm_managed_devops_pool"
      ],
      "Azure Managed Lustre File System": [
        "azurerm_managed_lustre_file_system"
      ],
      "Managed Redis": [
        "azurerm_managed_redis",
        "azurerm_managed_redis_access_policy_assignment",
        "azurerm_managed_redis_geo_replication"
      ],
      "Management": [
        "azurerm_management_group",
        "azurerm_management_group_subscription_association",
        "azurerm_management_lock",
        "azurerm_resource_management_private_link",
        "azurerm_resource_management_private_link_association"
      ],
      "Policy": [
        "azurerm_management_group_policy_assignment",
        "azurerm_management_group_policy_exemption",
        "azurerm_management_group_policy_remediation",
        "azurerm_management_group_policy_set_definition",
        "azurerm_policy_definition",
        "azurerm_policy_set_definition",
        "azurerm_policy_virtual_machine_configuration_assignment",
        "azurerm_resource_group_policy_assignment",
        "azurerm_resource_group_policy_exemption",
        "azurerm_resource_group_policy_remediation",
        "azurerm_resource_policy_assignment",
        "azurerm_resource_policy_exemption",
        "azurerm_resource_policy_remediation",
        "azurerm_subscription_policy_assignment",
        "azurerm_subscription_policy_exemption",
        "azurerm_subscription_policy_remediation"
      ],
      "Template": [
        "azurerm_management_group_template_deployment",
        "azurerm_resource_deployment_script_azure_cli",
        "azurerm_resource_deployment_script_azure_power_shell",
        "azurerm_resource_group_template_deployment",
        "azurerm_subscription_template_deployment",
        "azurerm_tenant_template_deployment"
      ],
      "Maps": [
        "azurerm_maps_account",
        "azurerm_maps_creator"
      ],
      "Mongo Cluster": [
        "azurerm_mongo_cluster",
        "azurerm_mongo_cluster_firewall_rule",
        "azurerm_mongo_cluster_user"
      ],
      "Monitor": [
        "azurerm_monitor_aad_diagnostic_setting",
        "azurerm_monitor_action_group",
        "azurerm_monitor_activity_log_alert",
        "azurerm_monitor_alert_processing_rule_action_group",
        "azurerm_monitor_alert_processing_rule_suppression",
        "azurerm_monitor_alert_prometheus_rule_group",
        "azurerm_monitor_autoscale_setting",
        "azurerm_monitor_data_collection_endpoint",
        "azurerm_monitor_data_collection_rule",
        "azurerm_monitor_data_collection_rule_association",
        "azurerm_monitor_diagnostic_setting",
        "azurerm_monitor_metric_alert",
        "azurerm_monitor_private_link_scope",
        "azurerm_monitor_private_link_scoped_service",
        "azurerm_monitor_scheduled_query_rules_alert",
        "azurerm_monitor_scheduled_query_rules_alert_v2",
        "azurerm_monitor_scheduled_query_rules_log",
        "azurerm_monitor_smart_detector_alert_rule",
        "azurerm_monitor_workspace"
      ],
      "Database": [
        "azurerm_mssql_database",
        "azurerm_mssql_database_extended_auditing_policy",
        "azurerm_mssql_database_vulnerability_assessment_rule_baseline",
        "azurerm_mssql_elasticpool",
        "azurerm_mssql_failover_group",
        "azurerm_mssql_firewall_rule",
        "azurerm_mssql_job",
        "azurerm_mssql_job_agent",
        "azurerm_mssql_job_credential",
        "azurerm_mssql_job_schedule",
        "azurerm_mssql_job_step",
        "azurerm_mssql_job_target_group",
        "azurerm_mssql_managed_database",
        "azurerm_mssql_managed_instance",
        "azurerm_mssql_managed_instance_active_directory_administrator",
        "azurerm_mssql_managed_instance_failover_group",
        "azurerm_mssql_managed_instance_security_alert_policy",
        "azurerm_mssql_managed_instance_start_stop_schedule",
        "azurerm_mssql_managed_instance_transparent_data_encryption",
        "azurerm_mssql_managed_instance_vulnerability_assessment",
        "azurerm_mssql_outbound_firewall_rule",
        "azurerm_mssql_server",
        "azurerm_mssql_server_dns_alias",
        "azurerm_mssql_server_extended_auditing_policy",
        "azurerm_mssql_server_microsoft_support_auditing_policy",
        "azurerm_mssql_server_security_alert_policy",
        "azurerm_mssql_server_transparent_data_encryption",
        "azurerm_mssql_server_vulnerability_assessment",
        "azurerm_mssql_virtual_machine",
        "azurerm_mssql_virtual_machine_availability_group_listener",
        "azurerm_mssql_virtual_machine_group",
        "azurerm_mssql_virtual_network_rule",
        "azurerm_mysql_flexible_database",
        "azurerm_mysql_flexible_server",
        "azurerm_mysql_flexible_server_active_directory_administrator",
        "azurerm_mysql_flexible_server_configuration",
        "azurerm_mysql_flexible_server_firewall_rule",
        "azurerm_postgresql_active_directory_administrator",
        "azurerm_postgresql_configuration",
        "azurerm_postgresql_database",
        "azurerm_postgresql_firewall_rule",
        "azurerm_postgresql_flexible_server",
        "azurerm_postgresql_flexible_server_active_directory_administrator",
        "azurerm_postgresql_flexible_server_backup",
        "azurerm_postgresql_flexible_server_configuration",
        "azurerm_postgresql_flexible_server_database",
        "azurerm_postgresql_flexible_server_firewall_rule",
        "azurerm_postgresql_flexible_server_virtual_endpoint",
        "azurerm_postgresql_server",
        "azurerm_postgresql_server_key",
        "azurerm_postgresql_virtual_network_rule"
      ],
      "NetApp": [
        "azurerm_netapp_account",
        "azurerm_netapp_account_encryption",
        "azurerm_netapp_backup_policy",
        "azurerm_netapp_backup_vault",
        "azurerm_netapp_pool",
        "azurerm_netapp_snapshot",
        "azurerm_netapp_snapshot_policy",
        "azurerm_netapp_volume",
        "azurerm_netapp_volume_bucket",
        "azurerm_netapp_volume_bucket_with_server",
        "azurerm_netapp_volume_group_oracle",
        "azurerm_netapp_volume_group_sap_hana",
        "azurerm_netapp_volume_quota_rule"
      ],
      "Network Function": [
        "azurerm_network_function_azure_traffic_collector",
        "azurerm_network_function_collector_policy"
      ],
      "New Relic": [
        "azurerm_new_relic_monitor",
        "azurerm_new_relic_tag_rule"
      ],
      "NGINX": [
        "azurerm_nginx_api_key",
        "azurerm_nginx_certificate",
        "azurerm_nginx_configuration",
        "azurerm_nginx_deployment"
      ],
      "Oracle": [
        "azurerm_oracle_autonomous_database",
        "azurerm_oracle_autonomous_database_backup",
        "azurerm_oracle_autonomous_database_clone_from_backup",
        "azurerm_oracle_autonomous_database_clone_from_database",
        "azurerm_oracle_cloud_vm_cluster",
        "azurerm_oracle_exadata_infrastructure",
        "azurerm_oracle_exascale_database_storage_vault",
        "azurerm_oracle_resource_anchor"
      ],
      "Orbital": [
        "azurerm_orbital_contact",
        "azurerm_orbital_contact_profile",
        "azurerm_orbital_spacecraft"
      ],
      "Palo Alto": [
        "azurerm_palo_alto_local_rulestack",
        "azurerm_palo_alto_local_rulestack_certificate",
        "azurerm_palo_alto_local_rulestack_fqdn_list",
        "azurerm_palo_alto_local_rulestack_outbound_trust_certificate_association",
        "azurerm_palo_alto_local_rulestack_outbound_untrust_certificate_association",
        "azurerm_palo_alto_local_rulestack_prefix_list",
        "azurerm_palo_alto_local_rulestack_rule",
        "azurerm_palo_alto_next_generation_firewall_virtual_hub_local_rulestack",
        "azurerm_palo_alto_next_generation_firewall_virtual_hub_panorama",
        "azurerm_palo_alto_next_generation_firewall_virtual_hub_strata_cloud_manager",
        "azurerm_palo_alto_next_generation_firewall_virtual_network_local_rulestack",
        "azurerm_palo_alto_next_generation_firewall_virtual_network_panorama",
        "azurerm_palo_alto_next_generation_firewall_virtual_network_strata_cloud_manager",
        "azurerm_palo_alto_virtual_network_appliance"
      ],
      "Portal": [
        "azurerm_portal_dashboard",
        "azurerm_portal_tenant_configuration"
      ],
      "PowerBI": [
        "azurerm_powerbi_embedded"
      ],
      "Private DNS": [
        "azurerm_private_dns_aaaa_record",
        "azurerm_private_dns_a_record",
        "azurerm_private_dns_cname_record",
        "azurerm_private_dns_mx_record",
        "azurerm_private_dns_ptr_record",
        "azurerm_private_dns_srv_record",
        "azurerm_private_dns_txt_record",
        "azurerm_private_dns_zone",
        "azurerm_private_dns_zone_virtual_network_link"
      ],
      "Private DNS Resolver": [
        "azurerm_private_dns_resolver",
        "azurerm_private_dns_resolver_dns_forwarding_ruleset",
        "azurerm_private_dns_resolver_forwarding_rule",
        "azurerm_private_dns_resolver_inbound_endpoint",
        "azurerm_private_dns_resolver_outbound_endpoint",
        "azurerm_private_dns_resolver_virtual_network_link"
      ],
      "Purview": [
        "azurerm_purview_account"
      ],
      "Qumulo": [
        "azurerm_qumulo_file_system"
      ],
      "Red Hat OpenShift": [
        "azurerm_redhat_openshift_cluster"
      ],
      "Redis": [
        "azurerm_redis_cache",
        "azurerm_redis_cache_access_policy",
        "azurerm_redis_cache_access_policy_assignment",
        "azurerm_redis_firewall_rule",
        "azurerm_redis_linked_server"
      ],
      "Redis Enterprise": [
        "azurerm_redis_enterprise_cluster",
        "azurerm_redis_enterprise_database"
      ],
      "Base": [
        "azurerm_resource_group",
        "azurerm_resource_provider_feature_registration",
        "azurerm_resource_provider_registration",
        "azurerm_subscription"
      ],
      "Search": [
        "azurerm_search_service",
        "azurerm_search_shared_private_link_service"
      ],
      "Sentinel": [
        "azurerm_sentinel_alert_rule_anomaly_built_in",
        "azurerm_sentinel_alert_rule_anomaly_duplicate",
        "azurerm_sentinel_alert_rule_fusion",
        "azurerm_sentinel_alert_rule_machine_learning_behavior_analytics",
        "azurerm_sentinel_alert_rule_ms_security_incident",
        "azurerm_sentinel_alert_rule_nrt",
        "azurerm_sentinel_alert_rule_scheduled",
        "azurerm_sentinel_alert_rule_threat_intelligence",
        "azurerm_sentinel_automation_rule",
        "azurerm_sentinel_data_connector_aws_cloud_trail",
        "azurerm_sentinel_data_connector_aws_s3",
        "azurerm_sentinel_data_connector_azure_active_directory",
        "azurerm_sentinel_data_connector_azure_advanced_threat_protection",
        "azurerm_sentinel_data_connector_azure_security_center",
        "azurerm_sentinel_data_connector_dynamics_365",
        "azurerm_sentinel_data_connector_iot",
        "azurerm_sentinel_data_connector_microsoft_cloud_app_security",
        "azurerm_sentinel_data_connector_microsoft_defender_advanced_threat_protection",
        "azurerm_sentinel_data_connector_microsoft_threat_intelligence",
        "azurerm_sentinel_data_connector_microsoft_threat_protection",
        "azurerm_sentinel_data_connector_office_365",
        "azurerm_sentinel_data_connector_office_365_project",
        "azurerm_sentinel_data_connector_office_atp",
        "azurerm_sentinel_data_connector_office_irm",
        "azurerm_sentinel_data_connector_office_power_bi",
        "azurerm_sentinel_data_connector_threat_intelligence",
        "azurerm_sentinel_data_connector_threat_intelligence_taxii",
        "azurerm_sentinel_log_analytics_workspace_onboarding",
        "azurerm_sentinel_metadata",
        "azurerm_sentinel_threat_intelligence_indicator",
        "azurerm_sentinel_watchlist",
        "azurerm_sentinel_watchlist_item"
      ],
      "Service Fabric": [
        "azurerm_service_fabric_cluster"
      ],
      "Service Fabric Managed Clusters": [
        "azurerm_service_fabric_managed_cluster"
      ],
      "Spring Cloud": [
        "azurerm_spring_cloud_accelerator",
        "azurerm_spring_cloud_active_deployment",
        "azurerm_spring_cloud_api_portal",
        "azurerm_spring_cloud_api_portal_custom_domain",
        "azurerm_spring_cloud_app",
        "azurerm_spring_cloud_app_cosmosdb_association",
        "azurerm_spring_cloud_app_dynamics_application_performance_monitoring",
        "azurerm_spring_cloud_application_insights_application_performance_monitoring",
        "azurerm_spring_cloud_application_live_view",
        "azurerm_spring_cloud_app_mysql_association",
        "azurerm_spring_cloud_app_redis_association",
        "azurerm_spring_cloud_build_deployment",
        "azurerm_spring_cloud_builder",
        "azurerm_spring_cloud_build_pack_binding",
        "azurerm_spring_cloud_certificate",
        "azurerm_spring_cloud_configuration_service",
        "azurerm_spring_cloud_connection",
        "azurerm_spring_cloud_container_deployment",
        "azurerm_spring_cloud_custom_domain",
        "azurerm_spring_cloud_customized_accelerator",
        "azurerm_spring_cloud_dev_tool_portal",
        "azurerm_spring_cloud_dynatrace_application_performance_monitoring",
        "azurerm_spring_cloud_elastic_application_performance_monitoring",
        "azurerm_spring_cloud_gateway",
        "azurerm_spring_cloud_gateway_custom_domain",
        "azurerm_spring_cloud_gateway_route_config",
        "azurerm_spring_cloud_java_deployment",
        "azurerm_spring_cloud_new_relic_application_performance_monitoring",
        "azurerm_spring_cloud_service",
        "azurerm_spring_cloud_storage"
      ],
      "Azure Stack HCI": [
        "azurerm_stack_hci_cluster",
        "azurerm_stack_hci_deployment_setting",
        "azurerm_stack_hci_extension",
        "azurerm_stack_hci_logical_network",
        "azurerm_stack_hci_marketplace_gallery_image",
        "azurerm_stack_hci_network_interface",
        "azurerm_stack_hci_storage_path",
        "azurerm_stack_hci_virtual_hard_disk"
      ],
      "Storage Mover": [
        "azurerm_storage_mover",
        "azurerm_storage_mover_agent",
        "azurerm_storage_mover_job_definition",
        "azurerm_storage_mover_project",
        "azurerm_storage_mover_source_endpoint",
        "azurerm_storage_mover_target_endpoint"
      ],
      "Stream Analytics": [
        "azurerm_stream_analytics_cluster",
        "azurerm_stream_analytics_function_javascript_uda",
        "azurerm_stream_analytics_function_javascript_udf",
        "azurerm_stream_analytics_job",
        "azurerm_stream_analytics_job_schedule",
        "azurerm_stream_analytics_job_storage_account",
        "azurerm_stream_analytics_managed_private_endpoint",
        "azurerm_stream_analytics_output_blob",
        "azurerm_stream_analytics_output_cosmosdb",
        "azurerm_stream_analytics_output_eventhub",
        "azurerm_stream_analytics_output_function",
        "azurerm_stream_analytics_output_mssql",
        "azurerm_stream_analytics_output_powerbi",
        "azurerm_stream_analytics_output_servicebus_queue",
        "azurerm_stream_analytics_output_servicebus_topic",
        "azurerm_stream_analytics_output_synapse",
        "azurerm_stream_analytics_output_table",
        "azurerm_stream_analytics_reference_input_blob",
        "azurerm_stream_analytics_reference_input_mssql",
        "azurerm_stream_analytics_stream_input_blob",
        "azurerm_stream_analytics_stream_input_eventhub",
        "azurerm_stream_analytics_stream_input_eventhub_v2",
        "azurerm_stream_analytics_stream_input_iothub"
      ],
      "Synapse": [
        "azurerm_synapse_firewall_rule",
        "azurerm_synapse_integration_runtime_azure",
        "azurerm_synapse_integration_runtime_self_hosted",
        "azurerm_synapse_linked_service",
        "azurerm_synapse_managed_private_endpoint",
        "azurerm_synapse_private_link_hub",
        "azurerm_synapse_role_assignment",
        "azurerm_synapse_spark_pool",
        "azurerm_synapse_sql_pool",
        "azurerm_synapse_sql_pool_extended_auditing_policy",
        "azurerm_synapse_sql_pool_security_alert_policy",
        "azurerm_synapse_sql_pool_vulnerability_assessment",
        "azurerm_synapse_sql_pool_vulnerability_assessment_baseline",
        "azurerm_synapse_sql_pool_workload_classifier",
        "azurerm_synapse_sql_pool_workload_group",
        "azurerm_synapse_workspace",
        "azurerm_synapse_workspace_aad_admin",
        "azurerm_synapse_workspace_extended_auditing_policy",
        "azurerm_synapse_workspace_key",
        "azurerm_synapse_workspace_security_alert_policy",
        "azurerm_synapse_workspace_sql_aad_admin",
        "azurerm_synapse_workspace_vulnerability_assessment"
      ],
      "System Center Virtual Machine Manager": [
        "azurerm_system_center_virtual_machine_manager_availability_set",
        "azurerm_system_center_virtual_machine_manager_cloud",
        "azurerm_system_center_virtual_machine_manager_server",
        "azurerm_system_center_virtual_machine_manager_virtual_machine_instance",
        "azurerm_system_center_virtual_machine_manager_virtual_machine_instance_guest_agent",
        "azurerm_system_center_virtual_machine_manager_virtual_machine_template",
        "azurerm_system_center_virtual_machine_manager_virtual_network"
      ],
      "Trusted Signing": [
        "azurerm_trusted_signing_account"
      ],
      "Video Indexer": [
        "azurerm_video_indexer_account"
      ],
      "Desktop Virtualization": [
        "azurerm_virtual_desktop_application",
        "azurerm_virtual_desktop_application_group",
        "azurerm_virtual_desktop_host_pool",
        "azurerm_virtual_desktop_host_pool_registration_info",
        "azurerm_virtual_desktop_scaling_plan",
        "azurerm_virtual_desktop_scaling_plan_host_pool_association",
        "azurerm_virtual_desktop_workspace",
        "azurerm_virtual_desktop_workspace_application_group_association"
      ],
      "Azure VMware Solution": [
        "azurerm_vmware_cluster",
        "azurerm_vmware_express_route_authorization",
        "azurerm_vmware_netapp_volume_attachment",
        "azurerm_vmware_private_cloud"
      ],
      "Workloads": [
        "azurerm_workloads_sap_discovery_virtual_instance",
        "azurerm_workloads_sap_single_node_virtual_instance",
        "azurerm_workloads_sap_three_tier_virtual_instance"
      ]
    }
  },
  "GCP": {
    "provider": "hashicorp/google",
    "version": "7.46.2",
    "services": {
      "Access Context Manager (VPC Service Controls)": [
        "google_access_context_manager_access_level",
        "google_access_context_manager_access_level_condition",
        "google_access_context_manager_access_levels",
        "google_access_context_manager_access_policy",
        "google_access_context_manager_access_policy_iam",
        "google_access_context_manager_authorized_orgs_desc",
        "google_access_context_manager_egress_policy",
        "google_access_context_manager_gcp_user_access_binding",
        "google_access_context_manager_ingress_policy",
        "google_access_context_manager_service_perimeter",
        "google_access_context_manager_service_perimeter_dry_run_egress_policy",
        "google_access_context_manager_service_perimeter_dry_run_ingress_policy",
        "google_access_context_manager_service_perimeter_dry_run_resource",
        "google_access_context_manager_service_perimeter_egress_policy",
        "google_access_context_manager_service_perimeter_ingress_policy",
        "google_access_context_manager_service_perimeter_resource",
        "google_access_context_manager_service_perimeters"
      ],
      "Managed Microsoft Active Directory": [
        "google_active_directory_domain",
        "google_active_directory_domain_trust",
        "google_active_directory_peering"
      ],
      "Agentic Applications": [
        "google_agentic_applications_analyst_agent_persona"
      ],
      "Agent Identity": [
        "google_agent_identity_auth_provider"
      ],
      "Agent Registry": [
        "google_agent_registry_binding",
        "google_agent_registry_service"
      ],
      "AlloyDB": [
        "google_alloydb_backup",
        "google_alloydb_cluster",
        "google_alloydb_instance",
        "google_alloydb_user"
      ],
      "API Gateway": [
        "google_api_gateway_api",
        "google_api_gateway_api_config",
        "google_api_gateway_api_config_iam",
        "google_api_gateway_api_iam",
        "google_api_gateway_gateway",
        "google_api_gateway_gateway_iam"
      ],
      "Apigee": [
        "google_apigee_addons_config",
        "google_apigee_api",
        "google_apigee_api_deployment",
        "google_apigee_api_product",
        "google_apigee_app_group",
        "google_apigee_control_plane_access",
        "google_apigee_data_collector",
        "google_apigee_datastore",
        "google_apigee_developer",
        "google_apigee_developer_app",
        "google_apigee_dns_zone",
        "google_apigee_endpoint_attachment",
        "google_apigee_envgroup",
        "google_apigee_envgroup_attachment",
        "google_apigee_environment",
        "google_apigee_environment_addons_config",
        "google_apigee_environment_api_revision_deployment",
        "google_apigee_environment_debugmask",
        "google_apigee_environment_iam",
        "google_apigee_environment_keyvaluemaps",
        "google_apigee_environment_keyvaluemaps_entries",
        "google_apigee_env_keystore",
        "google_apigee_env_references",
        "google_apigee_flowhook",
        "google_apigee_instance",
        "google_apigee_instance_attachment",
        "google_apigee_keystores_aliases_key_cert_file",
        "google_apigee_keystores_aliases_pkcs12",
        "google_apigee_keystores_aliases_self_signed_cert",
        "google_apigee_nat_address",
        "google_apigee_organization",
        "google_apigee_security_action",
        "google_apigee_security_feedback",
        "google_apigee_security_monitoring_condition",
        "google_apigee_security_profile_v2",
        "google_apigee_sharedflow",
        "google_apigee_sharedflow_deployment",
        "google_apigee_space",
        "google_apigee_sync_authorization",
        "google_apigee_target_server"
      ],
      "API Hub": [
        "google_apihub_api_hub_instance",
        "google_apihub_curation",
        "google_apihub_host_project_registration",
        "google_apihub_plugin",
        "google_apihub_plugin_instance",
        "google_apihub_runtime_project_attachment"
      ],
      "Apikeys": [
        "google_apikeys_key"
      ],
      "App Engine": [
        "google_app_engine_application",
        "google_app_engine_application_url_dispatch_rules",
        "google_app_engine_domain_mapping",
        "google_app_engine_firewall_rule",
        "google_app_engine_flexible_app_version",
        "google_app_engine_service_network_settings",
        "google_app_engine_service_split_traffic",
        "google_app_engine_standard_app_version"
      ],
      "App Hub": [
        "google_apphub_application",
        "google_apphub_boundary",
        "google_apphub_service",
        "google_apphub_service_project_attachment",
        "google_apphub_workload"
      ],
      "Artifact Registry": [
        "google_artifact_registry_project_config",
        "google_artifact_registry_repository",
        "google_artifact_registry_repository_iam",
        "google_artifact_registry_rule",
        "google_artifact_registry_vpcsc_config"
      ],
      "AssuredWorkloads": [
        "google_assured_workloads_workload"
      ],
      "Backup and DR Service": [
        "google_backup_dr_backup_plan",
        "google_backup_dr_backup_plan_association",
        "google_backup_dr_backup_vault",
        "google_backup_dr_management_server",
        "google_backup_dr_restore_workload",
        "google_backup_dr_service_config"
      ],
      "BeyondCorp": [
        "google_beyondcorp_app_connection",
        "google_beyondcorp_app_connector",
        "google_beyondcorp_app_gateway",
        "google_beyondcorp_security_gateway",
        "google_beyondcorp_security_gateway_application",
        "google_beyondcorp_security_gateway_application_iam",
        "google_beyondcorp_security_gateway_iam"
      ],
      "Biglake": [
        "google_biglake_catalog",
        "google_biglake_database",
        "google_biglake_iceberg_catalog",
        "google_biglake_iceberg_catalog_iam",
        "google_biglake_iceberg_namespace",
        "google_biglake_iceberg_namespace_iam",
        "google_biglake_iceberg_table",
        "google_biglake_iceberg_table_iam",
        "google_biglake_table"
      ],
      "BigLake Hive Metastore": [
        "google_biglake_hive_catalog",
        "google_biglake_hive_catalog_iam",
        "google_biglake_hive_database",
        "google_biglake_hive_database_iam",
        "google_biglake_hive_table",
        "google_biglake_hive_table_iam"
      ],
      "BigQuery Analytics Hub": [
        "google_bigquery_analytics_hub_data_exchange",
        "google_bigquery_analytics_hub_data_exchange_iam",
        "google_bigquery_analytics_hub_data_exchange_subscription",
        "google_bigquery_analytics_hub_listing",
        "google_bigquery_analytics_hub_listing_iam",
        "google_bigquery_analytics_hub_listing_subscription",
        "google_bigquery_analytics_hub_query_template"
      ],
      "BigQuery Reservation": [
        "google_bigquery_bi_reservation",
        "google_bigquery_capacity_commitment",
        "google_bigquery_reservation",
        "google_bigquery_reservation_assignment",
        "google_bigquery_reservation_group"
      ],
      "BigQuery Connection": [
        "google_bigquery_connection",
        "google_bigquery_connection_iam"
      ],
      "BigQuery Data Policy": [
        "google_bigquery_datapolicy_data_policy",
        "google_bigquery_datapolicy_data_policy_iam"
      ],
      "BigQuery Data Policy V2": [
        "google_bigquery_datapolicyv2_data_policy",
        "google_bigquery_datapolicyv2_data_policy_iam"
      ],
      "BigQuery": [
        "google_bigquery_dataset",
        "google_bigquery_dataset_access",
        "google_bigquery_dataset_iam",
        "google_bigquery_job",
        "google_bigquery_routine",
        "google_bigquery_routine_iam",
        "google_bigquery_row_access_policy",
        "google_bigquery_table",
        "google_bigquery_table_iam"
      ],
      "BigQuery Data Transfer": [
        "google_bigquery_data_transfer_config"
      ],
      "Cloud Bigtable": [
        "google_bigtable_app_profile",
        "google_bigtable_authorized_view",
        "google_bigtable_gc_policy",
        "google_bigtable_instance",
        "google_bigtable_instance_iam",
        "google_bigtable_logical_view",
        "google_bigtable_materialized_view",
        "google_bigtable_schema_bundle",
        "google_bigtable_table",
        "google_bigtable_table_iam"
      ],
      "Cloud Billing": [
        "google_billing_account_iam",
        "google_billing_budget",
        "google_billing_project_info"
      ],
      "Binary Authorization": [
        "google_binary_authorization_attestor",
        "google_binary_authorization_attestor_iam",
        "google_binary_authorization_policy"
      ],
      "Blockchain Node Engine": [
        "google_blockchain_node_engine_blockchain_nodes"
      ],
      "Certificate Manager": [
        "google_certificate_manager_certificate",
        "google_certificate_manager_certificate_issuance_config",
        "google_certificate_manager_certificate_map",
        "google_certificate_manager_certificate_map_entry",
        "google_certificate_manager_dns_authorization",
        "google_certificate_manager_trust_config"
      ],
      "Customer Engagement Suite": [
        "google_ces_agent",
        "google_ces_app",
        "google_ces_app_root_agent_association",
        "google_ces_app_version",
        "google_ces_deployment",
        "google_ces_evaluation",
        "google_ces_example",
        "google_ces_guardrail",
        "google_ces_security_settings",
        "google_ces_tool",
        "google_ces_toolset"
      ],
      "Chronicle": [
        "google_chronicle_big_query_export",
        "google_chronicle_custom_list",
        "google_chronicle_dashboard_chart",
        "google_chronicle_data_access_label",
        "google_chronicle_data_access_scope",
        "google_chronicle_data_export",
        "google_chronicle_data_table",
        "google_chronicle_data_table_row",
        "google_chronicle_environment",
        "google_chronicle_environment_group",
        "google_chronicle_feed",
        "google_chronicle_findings_refinement",
        "google_chronicle_findings_refinement_deployment",
        "google_chronicle_native_dashboard",
        "google_chronicle_parser",
        "google_chronicle_parser_extension",
        "google_chronicle_reference_list",
        "google_chronicle_retrohunt",
        "google_chronicle_rule",
        "google_chronicle_rule_deployment",
        "google_chronicle_soar_domain",
        "google_chronicle_soar_network",
        "google_chronicle_watchlist"
      ],
      "Cloud Asset Inventory": [
        "google_cloud_asset_folder_feed",
        "google_cloud_asset_organization_feed",
        "google_cloud_asset_project_feed"
      ],
      "Cloud Build": [
        "google_cloudbuild_bitbucket_server_config",
        "google_cloudbuild_trigger",
        "google_cloudbuild_worker_pool"
      ],
      "Cloud Build v2": [
        "google_cloudbuildv2_connection",
        "google_cloudbuildv2_connection_iam",
        "google_cloudbuildv2_repository"
      ],
      "Cloud Deploy": [
        "google_clouddeploy_automation",
        "google_clouddeploy_custom_target_type",
        "google_clouddeploy_custom_target_type_iam",
        "google_clouddeploy_delivery_pipeline",
        "google_clouddeploy_delivery_pipeline_iam",
        "google_clouddeploy_deploy_policy",
        "google_clouddeploy_target",
        "google_clouddeploy_target_iam"
      ],
      "Cloud Domains": [
        "google_clouddomains_registration"
      ],
      "Cloud Functions (2nd gen)": [
        "google_cloudfunctions2_function",
        "google_cloudfunctions2_function_iam"
      ],
      "Cloud Functions": [
        "google_cloudfunctions_function",
        "google_cloudfunctions_function_iam"
      ],
      "Cloud Identity": [
        "google_cloud_identity_group",
        "google_cloud_identity_group_membership",
        "google_cloud_identity_policy"
      ],
      "Cloud Intrusion Detection Service": [
        "google_cloud_ids_endpoint"
      ],
      "Cloud Quotas": [
        "google_cloud_quotas_quota_adjuster_settings",
        "google_cloud_quotas_quota_preference"
      ],
      "Cloud Run": [
        "google_cloud_run_domain_mapping",
        "google_cloud_run_service",
        "google_cloud_run_service_iam"
      ],
      "Cloud Run (v2 API)": [
        "google_cloud_run_v2_job",
        "google_cloud_run_v2_job_iam",
        "google_cloud_run_v2_service",
        "google_cloud_run_v2_service_iam",
        "google_cloud_run_v2_worker_pool",
        "google_cloud_run_v2_worker_pool_iam"
      ],
      "Cloud Scheduler": [
        "google_cloud_scheduler_job"
      ],
      "Cloud Security Compliance": [
        "google_cloud_security_compliance_cloud_control",
        "google_cloud_security_compliance_framework",
        "google_cloud_security_compliance_framework_deployment"
      ],
      "Cloud Support": [
        "google_cloud_support_support_event_subscription"
      ],
      "Cloud Tasks": [
        "google_cloud_tasks_queue",
        "google_cloud_tasks_queue_iam"
      ],
      "Colab Enterprise": [
        "google_colab_notebook_execution",
        "google_colab_runtime",
        "google_colab_runtime_template",
        "google_colab_runtime_template_iam",
        "google_colab_schedule"
      ],
      "Managed Service for Apache Airflow": [
        "google_composer_environment",
        "google_composer_user_workloads_secret"
      ],
      "Cloud Composer": [
        "google_composer_user_workloads_config_map"
      ],
      "Compute Engine": [
        "google_compute_address",
        "google_compute_attached_disk",
        "google_compute_autoscaler",
        "google_compute_backend_bucket",
        "google_compute_backend_bucket_iam",
        "google_compute_backend_bucket_signed_url_key",
        "google_compute_backend_service",
        "google_compute_backend_service_iam",
        "google_compute_backend_service_signed_url_key",
        "google_compute_bulk_per_instance_config",
        "google_compute_cross_site_network",
        "google_compute_disk",
        "google_compute_disk_async_replication",
        "google_compute_disk_iam",
        "google_compute_disk_resource_policy_attachment",
        "google_compute_external_vpn_gateway",
        "google_compute_firewall",
        "google_compute_firewall_policy",
        "google_compute_firewall_policy_association",
        "google_compute_firewall_policy_iam",
        "google_compute_firewall_policy_rule",
        "google_compute_firewall_policy_with_rules",
        "google_compute_forwarding_rule",
        "google_compute_future_reservation",
        "google_compute_global_address",
        "google_compute_global_forwarding_rule",
        "google_compute_global_network_endpoint",
        "google_compute_global_network_endpoint_group",
        "google_compute_global_vm_extension_policy",
        "google_compute_ha_vpn_gateway",
        "google_compute_health_check",
        "google_compute_http_health_check",
        "google_compute_https_health_check",
        "google_compute_image",
        "google_compute_image_iam",
        "google_compute_instance",
        "google_compute_instance_from_machine_image",
        "google_compute_instance_from_template",
        "google_compute_instance_group",
        "google_compute_instance_group_manager",
        "google_compute_instance_group_membership",
        "google_compute_instance_group_named_port",
        "google_compute_instance_iam",
        "google_compute_instance_settings",
        "google_compute_instance_template",
        "google_compute_instance_template_iam",
        "google_compute_instant_snapshot",
        "google_compute_instant_snapshot_iam",
        "google_compute_interconnect",
        "google_compute_interconnect_attachment",
        "google_compute_interconnect_attachment_group",
        "google_compute_interconnect_group",
        "google_compute_machine_image",
        "google_compute_machine_image_iam",
        "google_compute_managed_ssl_certificate",
        "google_compute_network",
        "google_compute_network_attachment",
        "google_compute_network_edge_security_service",
        "google_compute_network_endpoint",
        "google_compute_network_endpoint_group",
        "google_compute_network_endpoints",
        "google_compute_network_firewall_policy",
        "google_compute_network_firewall_policy_association",
        "google_compute_network_firewall_policy_iam",
        "google_compute_network_firewall_policy_packet_mirroring_rule",
        "google_compute_network_firewall_policy_rule",
        "google_compute_network_firewall_policy_with_rules",
        "google_compute_network_peering",
        "google_compute_network_peering_routes_config",
        "google_compute_node_group",
        "google_compute_node_template",
        "google_compute_organization_security_policy",
        "google_compute_organization_security_policy_association",
        "google_compute_organization_security_policy_rule",
        "google_compute_packet_mirroring",
        "google_compute_per_instance_config",
        "google_compute_preview_feature",
        "google_compute_project_cloud_armor_tier",
        "google_compute_project_default_network_tier",
        "google_compute_project_metadata",
        "google_compute_project_metadata_item",
        "google_compute_public_advertised_prefix",
        "google_compute_public_delegated_prefix",
        "google_compute_region_autoscaler",
        "google_compute_region_backend_bucket",
        "google_compute_region_backend_bucket_iam",
        "google_compute_region_backend_service",
        "google_compute_region_backend_service_iam",
        "google_compute_region_commitment",
        "google_compute_region_composite_health_check",
        "google_compute_region_disk",
        "google_compute_region_disk_iam",
        "google_compute_region_disk_resource_policy_attachment",
        "google_compute_region_health_aggregation_policy",
        "google_compute_region_health_check",
        "google_compute_region_health_source",
        "google_compute_region_instance_group_manager",
        "google_compute_region_instance_template",
        "google_compute_region_instant_snapshot",
        "google_compute_region_instant_snapshot_iam",
        "google_compute_region_network_endpoint",
        "google_compute_region_network_endpoint_group",
        "google_compute_region_network_firewall_policy",
        "google_compute_region_network_firewall_policy_association",
        "google_compute_region_network_firewall_policy_iam",
        "google_compute_region_network_firewall_policy_rule",
        "google_compute_region_network_firewall_policy_with_rules",
        "google_compute_region_network_policy",
        "google_compute_region_network_policy_traffic_classification_rule",
        "google_compute_region_per_instance_config",
        "google_compute_region_resize_request",
        "google_compute_region_security_policy",
        "google_compute_region_security_policy_rule",
        "google_compute_region_ssl_certificate",
        "google_compute_region_ssl_policy",
        "google_compute_region_target_http_proxy",
        "google_compute_region_target_https_proxy",
        "google_compute_region_target_tcp_proxy",
        "google_compute_region_url_map",
        "google_compute_reservation",
        "google_compute_resize_request",
        "google_compute_resource_policy",
        "google_compute_resource_policy_attachment",
        "google_compute_rollout_plan",
        "google_compute_route",
        "google_compute_router",
        "google_compute_router_interface",
        "google_compute_router_named_set",
        "google_compute_router_nat",
        "google_compute_router_nat_address",
        "google_compute_router_peer",
        "google_compute_router_route_policy",
        "google_compute_security_policy",
        "google_compute_security_policy_rule",
        "google_compute_service_attachment",
        "google_compute_shared_vpc_host_project",
        "google_compute_shared_vpc_service_project",
        "google_compute_snapshot",
        "google_compute_snapshot_iam",
        "google_compute_snapshot_settings",
        "google_compute_ssl_certificate",
        "google_compute_ssl_policy",
        "google_compute_storage_pool",
        "google_compute_storage_pool_iam",
        "google_compute_subnetwork",
        "google_compute_subnetwork_iam",
        "google_compute_target_grpc_proxy",
        "google_compute_target_http_proxy",
        "google_compute_target_https_proxy",
        "google_compute_target_instance",
        "google_compute_target_pool",
        "google_compute_target_ssl_proxy",
        "google_compute_target_tcp_proxy",
        "google_compute_url_map",
        "google_compute_vpn_gateway",
        "google_compute_vpn_tunnel",
        "google_compute_wire_group",
        "google_compute_zone_vm_extension_policy",
        "google_project_usage_export_bucket"
      ],
      "Infrastructure Manager": [
        "google_config_deployment"
      ],
      "Contact Center AI Insights": [
        "google_contact_center_insights_analysis_rule",
        "google_contact_center_insights_assessment_rule",
        "google_contact_center_insights_auto_labeling_rule",
        "google_contact_center_insights_encryption_spec",
        "google_contact_center_insights_qa_question",
        "google_contact_center_insights_qa_scorecard",
        "google_contact_center_insights_qa_scorecard_revision",
        "google_contact_center_insights_view"
      ],
      "Container Registry": [
        "google_container_analysis_note",
        "google_container_analysis_note_iam",
        "google_container_analysis_occurrence",
        "google_container_registry"
      ],
      "ContainerAttached": [
        "google_container_attached_cluster"
      ],
      "ContainerAws": [
        "google_container_aws_cluster",
        "google_container_aws_node_pool"
      ],
      "ContainerAzure": [
        "google_container_azure_client",
        "google_container_azure_cluster",
        "google_container_azure_node_pool"
      ],
      "Kubernetes (Container) Engine": [
        "google_container_cluster",
        "google_container_node_pool"
      ],
      "DatabaseMigrationService": [
        "google_database_migration_service_connection_profile",
        "google_database_migration_service_migration_job",
        "google_database_migration_service_private_connection"
      ],
      "Data Catalog": [
        "google_data_catalog_entry",
        "google_data_catalog_entry_group",
        "google_data_catalog_entry_group_iam",
        "google_data_catalog_policy_tag",
        "google_data_catalog_policy_tag_iam",
        "google_data_catalog_tag",
        "google_data_catalog_tag_template",
        "google_data_catalog_tag_template_iam",
        "google_data_catalog_taxonomy",
        "google_data_catalog_taxonomy_iam"
      ],
      "Dataflow": [
        "google_dataflow_flex_template_job",
        "google_dataflow_job"
      ],
      "Dataform": [
        "google_dataform_config",
        "google_dataform_folder",
        "google_dataform_repository",
        "google_dataform_repository_iam",
        "google_dataform_repository_release_config",
        "google_dataform_repository_workflow_config",
        "google_dataform_team_folder"
      ],
      "Cloud Data Fusion": [
        "google_data_fusion_instance",
        "google_data_fusion_instance_iam"
      ],
      "Data Lineage": [
        "google_data_lineage_config"
      ],
      "Data Loss Prevention": [
        "google_data_loss_prevention_deidentify_template",
        "google_data_loss_prevention_discovery_config",
        "google_data_loss_prevention_inspect_template",
        "google_data_loss_prevention_job_trigger",
        "google_data_loss_prevention_stored_info_type"
      ],
      "DataPipeline": [
        "google_data_pipeline_pipeline"
      ],
      "Dataplex": [
        "google_dataplex_aspect_type",
        "google_dataplex_aspect_type_iam",
        "google_dataplex_asset",
        "google_dataplex_asset_iam",
        "google_dataplex_data_asset",
        "google_dataplex_data_product",
        "google_dataplex_data_product_data_asset",
        "google_dataplex_data_product_iam",
        "google_dataplex_datascan",
        "google_dataplex_datascan_iam",
        "google_dataplex_entry",
        "google_dataplex_entry_group",
        "google_dataplex_entry_group_iam",
        "google_dataplex_entry_link",
        "google_dataplex_entry_type",
        "google_dataplex_entry_type_iam",
        "google_dataplex_glossary",
        "google_dataplex_glossary_category",
        "google_dataplex_glossary_iam",
        "google_dataplex_glossary_term",
        "google_dataplex_lake",
        "google_dataplex_lake_iam",
        "google_dataplex_metadata_feed",
        "google_dataplex_task",
        "google_dataplex_task_iam",
        "google_dataplex_zone",
        "google_dataplex_zone_iam"
      ],
      "Dataproc": [
        "google_dataproc_autoscaling_policy",
        "google_dataproc_autoscaling_policy_iam",
        "google_dataproc_batch",
        "google_dataproc_cluster",
        "google_dataproc_cluster_iam",
        "google_dataproc_job",
        "google_dataproc_job_iam",
        "google_dataproc_session_template",
        "google_dataproc_workflow_template"
      ],
      "Dataproc on GDC": [
        "google_dataproc_gdc_application_environment",
        "google_dataproc_gdc_service_instance",
        "google_dataproc_gdc_spark_application"
      ],
      "Dataproc Metastore": [
        "google_dataproc_metastore_database_iam",
        "google_dataproc_metastore_federation",
        "google_dataproc_metastore_federation_iam",
        "google_dataproc_metastore_service",
        "google_dataproc_metastore_service_iam",
        "google_dataproc_metastore_table_iam"
      ],
      "Datastream": [
        "google_datastream_connection_profile",
        "google_datastream_private_connection",
        "google_datastream_stream"
      ],
      "Cloud Deployment Manager": [
        "google_deployment_manager_deployment"
      ],
      "Developer Connect": [
        "google_developer_connect_account_connector",
        "google_developer_connect_connection",
        "google_developer_connect_git_repository_link",
        "google_developer_connect_insights_config"
      ],
      "Dialogflow": [
        "google_dialogflow_agent",
        "google_dialogflow_conversation_profile",
        "google_dialogflow_encryption_spec",
        "google_dialogflow_entity_type",
        "google_dialogflow_environment",
        "google_dialogflow_fulfillment",
        "google_dialogflow_generator",
        "google_dialogflow_intent",
        "google_dialogflow_sip_trunk",
        "google_dialogflow_version"
      ],
      "Dialogflow CX": [
        "google_dialogflow_cx_agent",
        "google_dialogflow_cx_entity_type",
        "google_dialogflow_cx_environment",
        "google_dialogflow_cx_flow",
        "google_dialogflow_cx_generative_settings",
        "google_dialogflow_cx_generator",
        "google_dialogflow_cx_intent",
        "google_dialogflow_cx_page",
        "google_dialogflow_cx_playbook",
        "google_dialogflow_cx_security_settings",
        "google_dialogflow_cx_test_case",
        "google_dialogflow_cx_tool",
        "google_dialogflow_cx_tool_version",
        "google_dialogflow_cx_version",
        "google_dialogflow_cx_webhook"
      ],
      "Discovery Engine": [
        "google_discovery_engine_acl_config",
        "google_discovery_engine_assistant",
        "google_discovery_engine_chat_engine",
        "google_discovery_engine_cmek_config",
        "google_discovery_engine_control",
        "google_discovery_engine_data_connector",
        "google_discovery_engine_data_store",
        "google_discovery_engine_license_config",
        "google_discovery_engine_recommendation_engine",
        "google_discovery_engine_schema",
        "google_discovery_engine_search_engine",
        "google_discovery_engine_search_engine_iam",
        "google_discovery_engine_serving_config",
        "google_discovery_engine_sitemap",
        "google_discovery_engine_target_site",
        "google_discovery_engine_user_store",
        "google_discovery_engine_widget_config"
      ],
      "Cloud DNS": [
        "google_dns_managed_zone",
        "google_dns_managed_zone_iam",
        "google_dns_policy",
        "google_dns_record_set",
        "google_dns_response_policy",
        "google_dns_response_policy_rule"
      ],
      "Document AI": [
        "google_document_ai_processor",
        "google_document_ai_processor_default_version",
        "google_document_ai_schema"
      ],
      "Document AI Warehouse": [
        "google_document_ai_warehouse_document_schema",
        "google_document_ai_warehouse_location"
      ],
      "Google Distributed Cloud Edge": [
        "google_edgecontainer_cluster",
        "google_edgecontainer_node_pool",
        "google_edgecontainer_vpn_connection"
      ],
      "Distributed Cloud Edge Network": [
        "google_edgenetwork_interconnect_attachment",
        "google_edgenetwork_network",
        "google_edgenetwork_subnet"
      ],
      "Cloud Endpoints": [
        "google_endpoints_service",
        "google_endpoints_service_consumers_iam",
        "google_endpoints_service_iam"
      ],
      "Essential Contacts": [
        "google_essential_contacts_contact"
      ],
      "Eventarc": [
        "google_eventarc_channel",
        "google_eventarc_enrollment",
        "google_eventarc_google_api_source",
        "google_eventarc_google_channel_config",
        "google_eventarc_message_bus",
        "google_eventarc_pipeline",
        "google_eventarc_trigger"
      ],
      "Filestore": [
        "google_filestore_backup",
        "google_filestore_instance",
        "google_filestore_snapshot"
      ],
      "Firebase AI Logic": [
        "google_firebase_ai_logic_config",
        "google_firebase_ai_logic_prompt_template",
        "google_firebase_ai_logic_prompt_template_lock"
      ],
      "Firebase": [
        "google_firebase_android_app",
        "google_firebase_apple_app",
        "google_firebase_project",
        "google_firebase_web_app"
      ],
      "Firebase App Check": [
        "google_firebase_app_check_app_attest_config",
        "google_firebase_app_check_debug_token",
        "google_firebase_app_check_device_check_config",
        "google_firebase_app_check_play_integrity_config",
        "google_firebase_app_check_recaptcha_enterprise_config",
        "google_firebase_app_check_recaptcha_v3_config",
        "google_firebase_app_check_resource_policy",
        "google_firebase_app_check_service_config"
      ],
      "Firebase App Hosting": [
        "google_firebase_app_hosting_backend",
        "google_firebase_app_hosting_build",
        "google_firebase_app_hosting_default_domain",
        "google_firebase_app_hosting_domain",
        "google_firebase_app_hosting_traffic"
      ],
      "Firebase Realtime Database": [
        "google_firebase_database_instance"
      ],
      "Firebase Data Connect": [
        "google_firebase_data_connect_service"
      ],
      "Firebase Extensions": [
        "google_firebase_extensions_instance"
      ],
      "Firebase Hosting": [
        "google_firebase_hosting_channel",
        "google_firebase_hosting_custom_domain",
        "google_firebase_hosting_release",
        "google_firebase_hosting_site",
        "google_firebase_hosting_version"
      ],
      "Firebase Remote Config": [
        "google_firebase_remote_config_remote_config"
      ],
      "Firebaserules": [
        "google_firebaserules_release",
        "google_firebaserules_ruleset"
      ],
      "Cloud Storage for Firebase": [
        "google_firebase_storage_bucket",
        "google_firebase_storage_default_bucket"
      ],
      "Firestore": [
        "google_firestore_backup_schedule",
        "google_firestore_change_stream",
        "google_firestore_database",
        "google_firestore_document",
        "google_firestore_field",
        "google_firestore_index",
        "google_firestore_user_creds"
      ],
      "Access Approval": [
        "google_folder_access_approval_settings",
        "google_organization_access_approval_settings",
        "google_project_access_approval_settings"
      ],
      "Cloud Platform": [
        "google_folder_service_identity",
        "google_google_billing_subaccount",
        "google_google_folder",
        "google_google_folder_iam",
        "google_google_folder_organization_policy",
        "google_google_organization_iam",
        "google_google_organization_iam_custom_role",
        "google_google_organization_policy",
        "google_google_project",
        "google_google_project_default_service_accounts",
        "google_google_project_iam",
        "google_google_project_iam_custom_role",
        "google_google_project_iam_member_remove",
        "google_google_project_organization_policy",
        "google_google_project_service",
        "google_google_service_account",
        "google_google_service_account_iam",
        "google_google_service_account_key",
        "google_organization_service_identity",
        "google_project_service_identity"
      ],
      "Gemini for Google Cloud": [
        "google_gemini_code_repository_index",
        "google_gemini_code_tools_setting",
        "google_gemini_code_tools_setting_binding",
        "google_gemini_data_sharing_with_google_setting",
        "google_gemini_data_sharing_with_google_setting_binding",
        "google_gemini_gemini_gcp_enablement_setting",
        "google_gemini_gemini_gcp_enablement_setting_binding",
        "google_gemini_logging_setting",
        "google_gemini_logging_setting_binding",
        "google_gemini_release_channel_setting",
        "google_gemini_release_channel_setting_binding",
        "google_gemini_repository_group",
        "google_gemini_repository_group_iam"
      ],
      "Backup for GKE": [
        "google_gke_backup_backup_channel",
        "google_gke_backup_backup_plan",
        "google_gke_backup_backup_plan_iam",
        "google_gke_backup_restore_channel",
        "google_gke_backup_restore_plan",
        "google_gke_backup_restore_plan_iam"
      ],
      "GKEHub": [
        "google_gke_hub_feature",
        "google_gke_hub_feature_iam",
        "google_gke_hub_feature_membership",
        "google_gke_hub_fleet",
        "google_gke_hub_membership",
        "google_gke_hub_membership_binding",
        "google_gke_hub_membership_iam",
        "google_gke_hub_membership_rbac_role_binding",
        "google_gke_hub_namespace",
        "google_gke_hub_rollout_sequence",
        "google_gke_hub_scope",
        "google_gke_hub_scope_iam",
        "google_gke_hub_scope_rbac_role_binding"
      ],
      "Anthos On-Prem": [
        "google_gkeonprem_bare_metal_admin_cluster",
        "google_gkeonprem_bare_metal_cluster",
        "google_gkeonprem_bare_metal_node_pool",
        "google_gkeonprem_vmware_admin_cluster",
        "google_gkeonprem_vmware_cluster",
        "google_gkeonprem_vmware_node_pool"
      ],
      "Cloud Key Management Service": [
        "google_google_kms_crypto_key_iam",
        "google_google_kms_key_ring_iam",
        "google_kms_autokey_config",
        "google_kms_crypto_key",
        "google_kms_crypto_key_version",
        "google_kms_ekm_connection",
        "google_kms_ekm_connection_iam",
        "google_kms_folder_kaj_policy_config",
        "google_kms_key_handle",
        "google_kms_key_ring",
        "google_kms_key_ring_import_job",
        "google_kms_organization_kaj_policy_config",
        "google_kms_project_autokey_config",
        "google_kms_project_kaj_policy_config",
        "google_kms_secret_ciphertext"
      ],
      "Service Networking": [
        "google_google_service_networking_peered_dns_domain",
        "google_service_networking_connection",
        "google_service_networking_vpc_service_controls"
      ],
      "Tags": [
        "google_google_tags_location_tag_binding",
        "google_tags_tag_binding",
        "google_tags_tag_key",
        "google_tags_tag_key_iam",
        "google_tags_tag_value",
        "google_tags_tag_value_iam"
      ],
      "Cloud Healthcare": [
        "google_healthcare_consent_store",
        "google_healthcare_consent_store_iam",
        "google_healthcare_dataset",
        "google_healthcare_dataset_iam",
        "google_healthcare_dicom_store",
        "google_healthcare_dicom_store_iam",
        "google_healthcare_fhir_store",
        "google_healthcare_fhir_store_iam",
        "google_healthcare_hl7_v2_store",
        "google_healthcare_hl7_v2_store_iam",
        "google_healthcare_pipeline_job",
        "google_healthcare_workspace"
      ],
      "Cluster Director": [
        "google_hypercomputecluster_cluster"
      ],
      "Cloud IAM": [
        "google_iam_access_boundary_policy",
        "google_iam_deny_policy",
        "google_iam_folder_access_policy",
        "google_iam_folders_policy_binding",
        "google_iam_oauth_client",
        "google_iam_oauth_client_credential",
        "google_iam_organization_access_policy",
        "google_iam_organizations_policy_binding",
        "google_iam_principal_access_boundary_policy",
        "google_iam_project_access_policy",
        "google_iam_projects_policy_binding",
        "google_iam_workforce_pool",
        "google_iam_workforce_pool_iam",
        "google_iam_workforce_pool_provider",
        "google_iam_workforce_pool_provider_key",
        "google_iam_workforce_pool_provider_scim_tenant",
        "google_iam_workforce_pool_provider_scim_token",
        "google_iam_workload_identity_pool",
        "google_iam_workload_identity_pool_iam",
        "google_iam_workload_identity_pool_managed_identity",
        "google_iam_workload_identity_pool_namespace",
        "google_iam_workload_identity_pool_provider"
      ],
      "Identity-Aware Proxy": [
        "google_iap_agent_registry_agent_iam",
        "google_iap_agent_registry_endpoint_iam",
        "google_iap_agent_registry_iam",
        "google_iap_agent_registry_mcp_server_iam",
        "google_iap_app_engine_service_iam",
        "google_iap_app_engine_version_iam",
        "google_iap_brand",
        "google_iap_client",
        "google_iap_location_web_iam",
        "google_iap_settings",
        "google_iap_tunnel_dest_group",
        "google_iap_tunnel_dest_group_iam",
        "google_iap_tunnel_iam",
        "google_iap_tunnel_instance_iam",
        "google_iap_web_backend_service_iam",
        "google_iap_web_cloud_run_service_iam",
        "google_iap_web_forwarding_rule_service_iam",
        "google_iap_web_iam",
        "google_iap_web_region_backend_service_iam",
        "google_iap_web_region_forwarding_rule_service_iam",
        "google_iap_web_type_app_engine_iam",
        "google_iap_web_type_compute_iam"
      ],
      "Identity Platform": [
        "google_identity_platform_config",
        "google_identity_platform_default_supported_idp_config",
        "google_identity_platform_inbound_saml_config",
        "google_identity_platform_oauth_idp_config",
        "google_identity_platform_tenant",
        "google_identity_platform_tenant_default_supported_idp_config",
        "google_identity_platform_tenant_inbound_saml_config",
        "google_identity_platform_tenant_oauth_idp_config"
      ],
      "Integration Connectors": [
        "google_integration_connectors_connection",
        "google_integration_connectors_endpoint_attachment",
        "google_integration_connectors_managed_zone"
      ],
      "Application Integration": [
        "google_integrations_auth_config",
        "google_integrations_client"
      ],
      "License Manager": [
        "google_license_manager_configuration"
      ],
      "Cloud (Stackdriver) Logging": [
        "google_logging_billing_account_bucket_config",
        "google_logging_billing_account_exclusion",
        "google_logging_billing_account_sink",
        "google_logging_folder_bucket_config",
        "google_logging_folder_exclusion",
        "google_logging_folder_settings",
        "google_logging_folder_sink",
        "google_logging_linked_dataset",
        "google_logging_log_scope",
        "google_logging_log_view",
        "google_logging_log_view_iam",
        "google_logging_metric",
        "google_logging_organization_bucket_config",
        "google_logging_organization_exclusion",
        "google_logging_organization_settings",
        "google_logging_organization_sink",
        "google_logging_project_bucket_config",
        "google_logging_project_exclusion",
        "google_logging_project_sink",
        "google_logging_saved_query"
      ],
      "Looker (Google Cloud core)": [
        "google_looker_instance"
      ],
      "Google Cloud Managed Lustre": [
        "google_lustre_instance"
      ],
      "Managed Kafka": [
        "google_managed_kafka_acl",
        "google_managed_kafka_cluster",
        "google_managed_kafka_connect_cluster",
        "google_managed_kafka_connector",
        "google_managed_kafka_topic"
      ],
      "Memcache": [
        "google_memcache_instance"
      ],
      "Memorystore": [
        "google_memorystore_acl_policy",
        "google_memorystore_instance",
        "google_memorystore_instance_desired_user_created_endpoints"
      ],
      "Migration Center": [
        "google_migration_center_assets_export_job",
        "google_migration_center_discovery_client",
        "google_migration_center_group",
        "google_migration_center_import_data_file",
        "google_migration_center_import_job",
        "google_migration_center_preference_set",
        "google_migration_center_report",
        "google_migration_center_report_config",
        "google_migration_center_settings",
        "google_migration_center_source"
      ],
      "ML Engine": [
        "google_ml_engine_model"
      ],
      "Model Armor": [
        "google_model_armor_floorsetting",
        "google_model_armor_template"
      ],
      "Cloud (Stackdriver) Monitoring": [
        "google_monitoring_alert_policy",
        "google_monitoring_custom_service",
        "google_monitoring_dashboard",
        "google_monitoring_group",
        "google_monitoring_metric_descriptor",
        "google_monitoring_monitored_project",
        "google_monitoring_notification_channel",
        "google_monitoring_service",
        "google_monitoring_slo",
        "google_monitoring_uptime_check_config"
      ],
      "Google Cloud NetApp Volumes": [
        "google_netapp_active_directory",
        "google_netapp_backup",
        "google_netapp_backup_policy",
        "google_netapp_backup_vault",
        "google_netapp_host_group",
        "google_netapp_kmsconfig",
        "google_netapp_storage_pool",
        "google_netapp_volume",
        "google_netapp_volume_quota_rule",
        "google_netapp_volume_replication",
        "google_netapp_volume_snapshot"
      ],
      "Network Connectivity": [
        "google_network_connectivity_destination",
        "google_network_connectivity_gateway_advertised_route",
        "google_network_connectivity_group",
        "google_network_connectivity_hub",
        "google_network_connectivity_hub_iam",
        "google_network_connectivity_internal_range",
        "google_network_connectivity_multicloud_data_transfer_config",
        "google_network_connectivity_policy_based_route",
        "google_network_connectivity_regional_endpoint",
        "google_network_connectivity_service_connection_policy",
        "google_network_connectivity_spoke",
        "google_network_connectivity_transport"
      ],
      "Network Management": [
        "google_network_management_connectivity_test",
        "google_network_management_organization_vpc_flow_logs_config",
        "google_network_management_vpc_flow_logs_config"
      ],
      "Network Security": [
        "google_network_security_address_group",
        "google_network_security_address_group_iam",
        "google_network_security_authorization_policy",
        "google_network_security_authz_policy",
        "google_network_security_backend_authentication_config",
        "google_network_security_client_tls_policy",
        "google_network_security_dns_threat_detector",
        "google_network_security_firewall_endpoint",
        "google_network_security_firewall_endpoint_association",
        "google_network_security_gateway_security_policy",
        "google_network_security_gateway_security_policy_rule",
        "google_network_security_intercept_deployment",
        "google_network_security_intercept_deployment_group",
        "google_network_security_intercept_endpoint_group",
        "google_network_security_intercept_endpoint_group_association",
        "google_network_security_mirroring_deployment",
        "google_network_security_mirroring_deployment_group",
        "google_network_security_mirroring_endpoint",
        "google_network_security_mirroring_endpoint_group",
        "google_network_security_mirroring_endpoint_group_association",
        "google_network_security_sac_attachment",
        "google_network_security_sac_realm",
        "google_network_security_security_profile",
        "google_network_security_security_profile_group",
        "google_network_security_server_tls_policy",
        "google_network_security_tls_inspection_policy",
        "google_network_security_ull_mirroring_collector",
        "google_network_security_ull_mirroring_collector_rule",
        "google_network_security_ull_mirroring_engine",
        "google_network_security_url_lists"
      ],
      "Network Services": [
        "google_network_services_agent_gateway",
        "google_network_services_authz_extension",
        "google_network_services_edge_cache_keyset",
        "google_network_services_edge_cache_origin",
        "google_network_services_edge_cache_service",
        "google_network_services_endpoint_policy",
        "google_network_services_gateway",
        "google_network_services_grpc_route",
        "google_network_services_http_route",
        "google_network_services_lb_edge_extension",
        "google_network_services_lb_route_extension",
        "google_network_services_lb_traffic_extension",
        "google_network_services_mesh",
        "google_network_services_multicast_consumer_association",
        "google_network_services_multicast_domain",
        "google_network_services_multicast_domain_activation",
        "google_network_services_multicast_domain_group",
        "google_network_services_multicast_group_consumer_activation",
        "google_network_services_multicast_group_producer_activation",
        "google_network_services_multicast_group_range",
        "google_network_services_multicast_group_range_activation",
        "google_network_services_multicast_producer_association",
        "google_network_services_service_binding",
        "google_network_services_service_lb_policies",
        "google_network_services_tcp_route",
        "google_network_services_tls_route",
        "google_network_services_wasm_plugin"
      ],
      "Cloud AI Notebooks": [
        "google_notebooks_environment",
        "google_notebooks_instance",
        "google_notebooks_instance_iam",
        "google_notebooks_runtime",
        "google_notebooks_runtime_iam"
      ],
      "Observability": [
        "google_observability_folder_settings",
        "google_observability_organization_settings",
        "google_observability_project_settings",
        "google_observability_trace_scope"
      ],
      "Oracle Database": [
        "google_oracle_database_autonomous_database",
        "google_oracle_database_cloud_exadata_infrastructure",
        "google_oracle_database_cloud_exadata_infrastructure_exascale_config",
        "google_oracle_database_cloud_vm_cluster",
        "google_oracle_database_db_system",
        "google_oracle_database_exadb_vm_cluster",
        "google_oracle_database_exascale_db_storage_vault",
        "google_oracle_database_goldengate_connection",
        "google_oracle_database_goldengate_connection_assignment",
        "google_oracle_database_goldengate_deployment",
        "google_oracle_database_odb_network",
        "google_oracle_database_odb_subnet"
      ],
      "Organization Policy": [
        "google_org_policy_custom_constraint",
        "google_org_policy_policy"
      ],
      "OS Config": [
        "google_os_config_guest_policies",
        "google_os_config_os_policy_assignment",
        "google_os_config_patch_deployment"
      ],
      "OS Config v2": [
        "google_os_config_v2_policy_orchestrator",
        "google_os_config_v2_policy_orchestrator_for_folder",
        "google_os_config_v2_policy_orchestrator_for_organization"
      ],
      "OS Login": [
        "google_os_login_ssh_public_key"
      ],
      "Parallelstore": [
        "google_parallelstore_instance"
      ],
      "Parameter Manager": [
        "google_parameter_manager_parameter",
        "google_parameter_manager_parameter_version",
        "google_parameter_manager_regional_parameter",
        "google_parameter_manager_regional_parameter_version"
      ],
      "Certificate Authority Service": [
        "google_privateca_ca_pool",
        "google_privateca_ca_pool_iam",
        "google_privateca_certificate",
        "google_privateca_certificate_authority",
        "google_privateca_certificate_template",
        "google_privateca_certificate_template_iam"
      ],
      "Privileged Access Manager": [
        "google_privileged_access_manager_entitlement",
        "google_privileged_access_manager_settings"
      ],
      "Public CA": [
        "google_public_ca_external_account_key"
      ],
      "Cloud Pub/Sub": [
        "google_pubsub_lite_reservation",
        "google_pubsub_lite_subscription",
        "google_pubsub_lite_topic",
        "google_pubsub_schema",
        "google_pubsub_schema_iam",
        "google_pubsub_subscription",
        "google_pubsub_subscription_iam",
        "google_pubsub_topic",
        "google_pubsub_topic_iam"
      ],
      "RecaptchaEnterprise": [
        "google_recaptcha_enterprise_key"
      ],
      "Memorystore (Redis)": [
        "google_redis_cluster",
        "google_redis_cluster_acl_policy",
        "google_redis_cluster_user_created_connections",
        "google_redis_instance"
      ],
      "Resource Manager": [
        "google_resource_manager_capability",
        "google_resource_manager_lien"
      ],
      "Runtime Configurator": [
        "google_runtimeconfig_config",
        "google_runtimeconfig_config_iam",
        "google_runtimeconfig_variable"
      ],
      "App Lifecycle Manager (SaaS Runtime)": [
        "google_saas_runtime_release",
        "google_saas_runtime_rollout_kind",
        "google_saas_runtime_saas",
        "google_saas_runtime_tenant",
        "google_saas_runtime_unit",
        "google_saas_runtime_unit_kind",
        "google_saas_runtime_unit_operation"
      ],
      "Security Command Center (SCC)": [
        "google_scc_event_threat_detection_custom_module",
        "google_scc_folder_custom_module",
        "google_scc_folder_notification_config",
        "google_scc_folder_scc_big_query_export",
        "google_scc_mute_config",
        "google_scc_notification_config",
        "google_scc_organization_custom_module",
        "google_scc_organization_scc_big_query_export",
        "google_scc_project_custom_module",
        "google_scc_project_notification_config",
        "google_scc_project_scc_big_query_export",
        "google_scc_source",
        "google_scc_source_iam"
      ],
      "Security Command Center Management (SCC)": [
        "google_scc_management_folder_security_health_analytics_custom_module",
        "google_scc_management_organization_event_threat_detection_custom_module",
        "google_scc_management_organization_security_health_analytics_custom_module",
        "google_scc_management_project_security_health_analytics_custom_module"
      ],
      "Security Command Center (SCC) v2 API": [
        "google_scc_v2_folder_mute_config",
        "google_scc_v2_folder_notification_config",
        "google_scc_v2_folder_scc_big_query_export",
        "google_scc_v2_organization_mute_config",
        "google_scc_v2_organization_notification_config",
        "google_scc_v2_organization_scc_big_query_export",
        "google_scc_v2_organization_scc_big_query_exports",
        "google_scc_v2_organization_source",
        "google_scc_v2_organization_source_iam",
        "google_scc_v2_project_mute_config",
        "google_scc_v2_project_notification_config",
        "google_scc_v2_project_scc_big_query_export"
      ],
      "Secret Manager": [
        "google_secret_manager_regional_secret",
        "google_secret_manager_regional_secret_iam",
        "google_secret_manager_regional_secret_version",
        "google_secret_manager_secret",
        "google_secret_manager_secret_iam",
        "google_secret_manager_secret_version"
      ],
      "Secure Source Manager": [
        "google_secure_source_manager_branch_rule",
        "google_secure_source_manager_hook",
        "google_secure_source_manager_instance",
        "google_secure_source_manager_instance_iam",
        "google_secure_source_manager_repository",
        "google_secure_source_manager_repository_iam"
      ],
      "Security Posture": [
        "google_securityposture_posture",
        "google_securityposture_posture_deployment"
      ],
      "Cloud Security Scanner": [
        "google_security_scanner_scan_config"
      ],
      "Service Directory": [
        "google_service_directory_endpoint",
        "google_service_directory_namespace",
        "google_service_directory_namespace_iam",
        "google_service_directory_service",
        "google_service_directory_service_iam"
      ],
      "Service Usage": [
        "google_service_usage_consumer_quota_override"
      ],
      "Site Verification": [
        "google_site_verification_owner",
        "google_site_verification_web_resource"
      ],
      "Cloud Source Repositories": [
        "google_sourcerepo_repository",
        "google_sourcerepo_repository_iam"
      ],
      "Cloud Spanner": [
        "google_spanner_backup_schedule",
        "google_spanner_database",
        "google_spanner_database_iam",
        "google_spanner_instance",
        "google_spanner_instance_config",
        "google_spanner_instance_iam",
        "google_spanner_instance_partition"
      ],
      "Cloud SQL": [
        "google_sql_database",
        "google_sql_database_instance",
        "google_sql_provision_script",
        "google_sql_source_representation_instance",
        "google_sql_ssl_cert",
        "google_sql_user"
      ],
      "Cloud Storage": [
        "google_storage_anywhere_cache",
        "google_storage_bucket",
        "google_storage_bucket_access_control",
        "google_storage_bucket_acl",
        "google_storage_bucket_iam",
        "google_storage_bucket_object",
        "google_storage_default_object_access_control",
        "google_storage_default_object_acl",
        "google_storage_folder",
        "google_storage_hmac_key",
        "google_storage_managed_folder",
        "google_storage_managed_folder_iam",
        "google_storage_notification",
        "google_storage_object_access_control",
        "google_storage_object_acl"
      ],
      "Cloud Storage Batch Operations": [
        "google_storage_batch_operations_job"
      ],
      "Cloud Storage Control": [
        "google_storage_control_folder_intelligence_config",
        "google_storage_control_organization_intelligence_config",
        "google_storage_control_project_intelligence_config"
      ],
      "Cloud Storage Insights": [
        "google_storage_insights_dataset_config",
        "google_storage_insights_report_config"
      ],
      "Storage Transfer Service": [
        "google_storage_transfer_agent_pool",
        "google_storage_transfer_job"
      ],
      "Cloud TPU v2": [
        "google_tpu_v2_queued_resource",
        "google_tpu_v2_vm"
      ],
      "Transcoder": [
        "google_transcoder_job",
        "google_transcoder_job_template"
      ],
      "Vector Search": [
        "google_vector_search_collection",
        "google_vector_search_data_object",
        "google_vector_search_index"
      ],
      "Vertex AI": [
        "google_vertex_ai_agent_anomaly_detection_scope",
        "google_vertex_ai_cache_config",
        "google_vertex_ai_dataset",
        "google_vertex_ai_deployment_resource_pool",
        "google_vertex_ai_endpoint",
        "google_vertex_ai_endpoint_iam",
        "google_vertex_ai_endpoint_with_model_garden_deployment",
        "google_vertex_ai_evaluation_metric",
        "google_vertex_ai_feature_group",
        "google_vertex_ai_feature_group_feature",
        "google_vertex_ai_feature_group_iam",
        "google_vertex_ai_feature_online_store",
        "google_vertex_ai_feature_online_store_featureview",
        "google_vertex_ai_feature_online_store_featureview_iam",
        "google_vertex_ai_feature_online_store_iam",
        "google_vertex_ai_featurestore",
        "google_vertex_ai_featurestore_entitytype",
        "google_vertex_ai_featurestore_entitytype_feature",
        "google_vertex_ai_featurestore_entitytype_iam",
        "google_vertex_ai_featurestore_iam",
        "google_vertex_ai_index",
        "google_vertex_ai_index_endpoint",
        "google_vertex_ai_index_endpoint_deployed_index",
        "google_vertex_ai_metadata_store",
        "google_vertex_ai_model_garden_enable_model",
        "google_vertex_ai_persistent_resource",
        "google_vertex_ai_rag_engine_config",
        "google_vertex_ai_reasoning_engine",
        "google_vertex_ai_reasoning_engine_iam",
        "google_vertex_ai_schedule",
        "google_vertex_ai_semantic_governance_policy_engine",
        "google_vertex_ai_tensorboard",
        "google_vertex_ai_tensorboard_experiment",
        "google_vertex_ai_tensorboard_run"
      ],
      "Cloud VMware Engine": [
        "google_vmwareengine_cluster",
        "google_vmwareengine_datastore",
        "google_vmwareengine_external_access_rule",
        "google_vmwareengine_external_address",
        "google_vmwareengine_network",
        "google_vmwareengine_network_peering",
        "google_vmwareengine_network_policy",
        "google_vmwareengine_private_cloud",
        "google_vmwareengine_subnet"
      ],
      "Serverless VPC Access": [
        "google_vpc_access_connector"
      ],
      "Vertex AI Workbench": [
        "google_workbench_instance",
        "google_workbench_instance_iam"
      ],
      "Workflows": [
        "google_workflows_workflow"
      ],
      "Workload Identity API": [
        "google_workload_identity_service_agent"
      ],
      "Cloud Workstations": [
        "google_workstations_workstation",
        "google_workstations_workstation_cluster",
        "google_workstations_workstation_config",
        "google_workstations_workstation_config_iam",
        "google_workstations_workstation_iam"
      ]
    }
  }
};
