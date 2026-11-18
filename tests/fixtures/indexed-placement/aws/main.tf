terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "6.73.0" }
  }
}
locals { prefixes = { blue = "10.0.1.0/24", green = "10.0.2.0/24" } }
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }
resource "aws_subnet" "app" {
  for_each   = local.prefixes
  cidr_block = each.value
  vpc_id     = aws_vpc.main.id
}
resource "aws_instance" "app" {
  for_each      = local.prefixes
  ami           = "ami-00000000000000000"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.app[each.key].id
}
