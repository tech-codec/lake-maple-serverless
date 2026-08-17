variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
  sensitive   = true
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "canadacentral"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "lakemaple"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "resource_group_name" {
  description = "Azure resource group name"
  type        = string
  default     = "rg-lake-maple-dev"
}

variable "cosmos_location" {
  description = "Azure region for Cosmos DB"
  type        = string
  default     = "canadaeast"
}

variable "organizer_email" {
  description = "Lake Maple competition organizer email"
  type        = string
}