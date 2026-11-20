terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
variable "archive_role_arn" { type = string }
provider "aws" { region = "ap-northeast-2" }
provider "aws" {
  alias  = "archive"
  region = "ap-northeast-2"
  assume_role { role_arn = var.archive_role_arn }
}
data "aws_caller_identity" "archive" { provider = aws.archive }
resource "aws_efs_file_system" "orders" {
  encrypted = true
  tags      = { Name = "orders" }
}
resource "aws_iam_role" "backup" {
  name = "orders-efs-backup"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "backup.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}
resource "aws_kms_key" "archive" {
  provider            = aws.archive
  description         = "EFS recovery points in the archive account"
  enable_key_rotation = true
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.archive.account_id}:root" }, Action = "kms:*", Resource = "*" },
      { Effect = "Allow", Principal = { AWS = aws_iam_role.backup.arn }, Action = ["kms:DescribeKey", "kms:Encrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*"], Resource = "*" },
      { Effect = "Allow", Principal = { AWS = aws_iam_role.backup.arn }, Action = "kms:CreateGrant", Resource = "*", Condition = { Bool = { "kms:GrantIsForAWSResource" = "true" } } }
    ]
  })
}
resource "aws_backup_vault" "source" { name = "orders-primary" }
resource "aws_backup_vault" "archive" {
  provider    = aws.archive
  name        = "orders-archive"
  kms_key_arn = aws_kms_key.archive.arn
}
resource "aws_backup_vault_policy" "receive" {
  provider          = aws.archive
  backup_vault_name = aws_backup_vault.archive.name
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect = "Allow", Principal = { AWS = aws_iam_role.backup.arn }, Action = "backup:CopyIntoBackupVault", Resource = aws_backup_vault.archive.arn
  }] })
}
resource "aws_iam_role_policy" "copy" {
  role = aws_iam_role.backup.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = "backup:CopyFromBackupVault", Resource = aws_backup_vault.source.arn },
    { Effect = "Allow", Action = "backup:CopyIntoBackupVault", Resource = aws_backup_vault.archive.arn },
    { Effect = "Allow", Action = ["kms:DescribeKey", "kms:Encrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:CreateGrant"], Resource = aws_kms_key.archive.arn }
  ] })
}
resource "aws_backup_plan" "orders" {
  name = "orders-daily"
  rule {
    rule_name         = "daily-copy"
    target_vault_name = aws_backup_vault.source.name
    schedule          = "cron(0 18 * * ? *)"
    lifecycle { delete_after = 14 }
    copy_action {
      destination_vault_arn = aws_backup_vault.archive.arn
      lifecycle { delete_after = 35 }
    }
  }
}
resource "aws_backup_selection" "orders" {
  name         = "orders-efs"
  plan_id      = aws_backup_plan.orders.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_efs_file_system.orders.arn]
  depends_on   = [aws_iam_role_policy_attachment.backup, aws_iam_role_policy.copy, aws_backup_vault_policy.receive]
}
