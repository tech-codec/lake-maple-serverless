output "resource_group_name" {
  description = "Lake Maple resource group"
  value       = azurerm_resource_group.lake_maple.name
}

output "function_app_name" {
  description = "Azure Function App name"
  value       = azurerm_linux_function_app.lake_maple.name
}

output "function_app_hostname" {
  description = "Azure Function App hostname"
  value       = azurerm_linux_function_app.lake_maple.default_hostname
}

output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.lake_maple.name
}

output "cosmos_account_name" {
  description = "Cosmos DB account name"
  value       = azurerm_cosmosdb_account.lake_maple.name
}

output "cosmos_endpoint" {
  description = "Cosmos DB endpoint"
  value       = azurerm_cosmosdb_account.lake_maple.endpoint
}

output "service_bus_namespace" {
  description = "Service Bus namespace"
  value       = azurerm_servicebus_namespace.lake_maple.name
}

output "application_insights_name" {
  description = "Application Insights resource"
  value       = azurerm_application_insights.lake_maple.name
}

output "communication_service_name" {
  description = "Azure Communication Services resource"
  value       = azurerm_communication_service.lake_maple.name
}

output "email_sender_domain" {
  description = "Azure managed email sender domain"
  value       = azurerm_email_communication_service_domain.lake_maple.mail_from_sender_domain
}

output "static_web_app_name" {
  description = "Azure Static Web App name"
  value       = azurerm_static_web_app.lake_maple.name
}

output "static_web_app_url" {
  description = "Azure Static Web App production URL"
  value       = "https://${azurerm_static_web_app.lake_maple.default_host_name}"
}