terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "6.73.0" }
  }
}
variable "subnet_id" { type = string }
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }
resource "aws_subnet" "app" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}
module "network" {
  source = "./module"
  input  = aws_subnet.app.id
}
resource "aws_instance" "direct" {
  ami           = "ami-example"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.app.id
}
resource "aws_instance" "variable" {
  ami           = "ami-example"
  instance_type = "t3.micro"
  subnet_id     = var.subnet_id
}
resource "aws_instance" "via_module" {
  ami           = "ami-example"
  instance_type = "t3.micro"
  subnet_id     = module.network.subnet_id
}
resource "aws_instance" "repeated" {
  for_each      = toset(["blue", "green"])
  ami           = "ami-example"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.app.id
}
resource "aws_instance" "dependency_only" {
  ami           = "ami-example"
  instance_type = "t3.micro"
  depends_on    = [aws_subnet.app]
}
resource "aws_subnet" "destination" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.2.0/24"
}
