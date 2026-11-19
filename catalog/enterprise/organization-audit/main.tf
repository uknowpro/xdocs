terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

variable "archive_role_arn" { type = string }
variable "workload_role_arn" { type = string }
variable "archive_bucket" { type = string }

# Default credentials belong to the existing Organizations management account.
provider "aws" { region = "ap-northeast-2" }
provider "aws" {
  alias  = "archive"
  region = "ap-northeast-2"
  assume_role { role_arn = var.archive_role_arn }
}
provider "aws" {
  alias  = "workload"
  region = "ap-northeast-2"
  assume_role { role_arn = var.workload_role_arn }
}

data "aws_organizations_organization" "org" {}
data "aws_caller_identity" "management" {}
resource "aws_s3_bucket" "audit" {
  provider = aws.archive
  bucket   = var.archive_bucket
}
resource "aws_s3_bucket_versioning" "retention" {
  provider = aws.archive
  bucket   = aws_s3_bucket.audit.id
  versioning_configuration { status = "Enabled" }
}
resource "aws_s3_bucket_public_access_block" "private" {
  provider                = aws.archive
  bucket                  = aws_s3_bucket.audit.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
locals {
  trail_arn = "arn:aws:cloudtrail:ap-northeast-2:${data.aws_caller_identity.management.account_id}:trail/org-management"
}
resource "aws_s3_bucket_policy" "delivery" {
  provider = aws.archive
  bucket   = aws_s3_bucket.audit.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Principal = { Service = "cloudtrail.amazonaws.com" }, Action = "s3:GetBucketAcl",
        Resource = aws_s3_bucket.audit.arn, Condition = { StringEquals = { "aws:SourceArn" = local.trail_arn } } },
      { Effect = "Allow", Principal = { Service = "cloudtrail.amazonaws.com" }, Action = "s3:PutObject",
        Resource = ["${aws_s3_bucket.audit.arn}/AWSLogs/${data.aws_caller_identity.management.account_id}/*",
                    "${aws_s3_bucket.audit.arn}/AWSLogs/${data.aws_organizations_organization.org.id}/*"],
        Condition = { StringEquals = { "aws:SourceArn" = local.trail_arn, "s3:x-amz-acl" = "bucket-owner-full-control" } } }
    ]
  })
}
resource "aws_cloudtrail" "organization" {
  name                          = "org-management"
  s3_bucket_name                = aws_s3_bucket.audit.id
  is_organization_trail         = true
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true
  depends_on = [aws_s3_bucket_policy.delivery, aws_s3_bucket_versioning.retention]
}
resource "aws_vpc" "application" {
  provider = aws.workload
  cidr_block = "10.72.0.0/16"
}
resource "aws_subnet" "zone_a" {
  provider = aws.workload
  vpc_id = aws_vpc.application.id
  availability_zone = "ap-northeast-2a"
  cidr_block = "10.72.10.0/24"
}
resource "aws_subnet" "zone_c" {
  provider = aws.workload
  vpc_id = aws_vpc.application.id
  availability_zone = "ap-northeast-2c"
  cidr_block = "10.72.20.0/24"
}
