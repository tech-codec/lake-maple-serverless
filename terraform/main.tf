terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id = var.subscription_id
}

# ---------------------------------------------------------
# Resource Group
# ---------------------------------------------------------

resource "azurerm_resource_group" "lake_maple" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Storage Account
# Used by Azure Functions and application data
# ---------------------------------------------------------

resource "azurerm_storage_account" "lake_maple" {
  name = substr(
    lower(replace("${var.project_name}${var.environment}sa", "-", "")),
    0,
    24
  )

  resource_group_name      = azurerm_resource_group.lake_maple.name
  location                 = azurerm_resource_group.lake_maple.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  min_tls_version = "TLS1_2"

  public_network_access_enabled = true

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Fish photos
resource "azurerm_storage_container" "fish_photos" {
  name                  = "fish-photos"
  storage_account_id    = azurerm_storage_account.lake_maple.id
  container_access_type = "private"
}

# Daily leaderboard reports
resource "azurerm_storage_container" "reports" {
  name                  = "reports"
  storage_account_id    = azurerm_storage_account.lake_maple.id
  container_access_type = "private"
}

# ---------------------------------------------------------
# Log Analytics
# ---------------------------------------------------------

resource "azurerm_log_analytics_workspace" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-logs"
  location            = azurerm_resource_group.lake_maple.location
  resource_group_name = azurerm_resource_group.lake_maple.name

  sku               = "PerGB2018"
  retention_in_days = 30

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Application Insights
# ---------------------------------------------------------

resource "azurerm_application_insights" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-insights"
  location            = azurerm_resource_group.lake_maple.location
  resource_group_name = azurerm_resource_group.lake_maple.name

  workspace_id     = azurerm_log_analytics_workspace.lake_maple.id
  application_type = "Node.JS"

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Azure Cosmos DB
# ---------------------------------------------------------

resource "azurerm_cosmosdb_account" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-cosmos"
  location            = var.cosmos_location
  resource_group_name = azurerm_resource_group.lake_maple.name

  offer_type = "Standard"
  kind       = "GlobalDocumentDB"

  # Serverless Cosmos DB
  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.cosmos_location
    failover_priority = 0
    zone_redundant    = false
  }

  public_network_access_enabled = true

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_cosmosdb_sql_database" "lake_maple" {
  name                = "LakeMapleDB"
  resource_group_name = azurerm_resource_group.lake_maple.name
  account_name        = azurerm_cosmosdb_account.lake_maple.name
}

# Contestants
resource "azurerm_cosmosdb_sql_container" "contestants" {
  name                = "contestants"
  resource_group_name = azurerm_resource_group.lake_maple.name
  account_name        = azurerm_cosmosdb_account.lake_maple.name
  database_name       = azurerm_cosmosdb_sql_database.lake_maple.name

  partition_key_paths = ["/id"]
}

# Fish catches
resource "azurerm_cosmosdb_sql_container" "fish_catches" {
  name                = "fishCatches"
  resource_group_name = azurerm_resource_group.lake_maple.name
  account_name        = azurerm_cosmosdb_account.lake_maple.name
  database_name       = azurerm_cosmosdb_sql_database.lake_maple.name

  partition_key_paths = ["/contestantId"]
}

# Leaderboards
resource "azurerm_cosmosdb_sql_container" "leaderboards" {
  name                = "leaderboards"
  resource_group_name = azurerm_resource_group.lake_maple.name
  account_name        = azurerm_cosmosdb_account.lake_maple.name
  database_name       = azurerm_cosmosdb_sql_database.lake_maple.name

  partition_key_paths = ["/fishType"]
}

# ---------------------------------------------------------
# Azure Service Bus
# ---------------------------------------------------------

resource "azurerm_servicebus_namespace" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-bus"
  location            = azurerm_resource_group.lake_maple.location
  resource_group_name = azurerm_resource_group.lake_maple.name

  sku = "Basic"

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_servicebus_queue" "registration" {
  name         = "registration-queue"
  namespace_id = azurerm_servicebus_namespace.lake_maple.id

  max_delivery_count = 10
}

resource "azurerm_servicebus_queue" "leader_change" {
  name         = "leader-change-queue"
  namespace_id = azurerm_servicebus_namespace.lake_maple.id

  max_delivery_count = 10
}

# ---------------------------------------------------------
# Azure Function App
# ---------------------------------------------------------

resource "azurerm_service_plan" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-plan"
  resource_group_name = azurerm_resource_group.lake_maple.name
  location            = azurerm_resource_group.lake_maple.location

  os_type  = "Linux"
  sku_name = "Y1"
}

resource "azurerm_linux_function_app" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-functions"
  location            = azurerm_resource_group.lake_maple.location
  resource_group_name = azurerm_resource_group.lake_maple.name

  service_plan_id = azurerm_service_plan.lake_maple.id

  storage_account_name       = azurerm_storage_account.lake_maple.name
  storage_account_access_key = azurerm_storage_account.lake_maple.primary_access_key

  functions_extension_version = "~4"

  site_config {
    application_stack {
      node_version = "22"
    }

    application_insights_connection_string = azurerm_application_insights.lake_maple.connection_string

    ftps_state = "Disabled"

    minimum_tls_version = "1.2"
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "node"

    FUNCTIONS_EXTENSION_VERSION = "~4"

    WEBSITE_NODE_DEFAULT_VERSION = "~22"

    WEBSITE_RUN_FROM_PACKAGE = "1"

    APPINSIGHTS_INSTRUMENTATIONKEY = azurerm_application_insights.lake_maple.instrumentation_key

    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.lake_maple.connection_string

    AzureWebJobsStorage = azurerm_storage_account.lake_maple.primary_connection_string

    LAKE_MAPLE_STORAGE_CONNECTION = azurerm_storage_account.lake_maple.primary_connection_string

    COSMOS_ENDPOINT = azurerm_cosmosdb_account.lake_maple.endpoint

    COSMOS_KEY = azurerm_cosmosdb_account.lake_maple.primary_key

    COSMOS_DATABASE = azurerm_cosmosdb_sql_database.lake_maple.name

    SERVICE_BUS_CONNECTION = azurerm_servicebus_namespace.lake_maple.default_primary_connection_string

    REGISTRATION_QUEUE = azurerm_servicebus_queue.registration.name

    LEADER_CHANGE_QUEUE = azurerm_servicebus_queue.leader_change.name

    FISH_PHOTOS_CONTAINER = azurerm_storage_container.fish_photos.name

    REPORTS_CONTAINER = azurerm_storage_container.reports.name

    COMMUNICATION_CONNECTION_STRING = azurerm_communication_service.lake_maple.primary_connection_string

    EMAIL_SENDER_DOMAIN = azurerm_email_communication_service_domain.lake_maple.mail_from_sender_domain

    ORGANIZER_EMAIL = var.organizer_email
  }

  identity {
    type = "SystemAssigned"
  }

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Azure Communication Services
# Used by NotifyOrganizer and NotifyPreviousLeader
# ---------------------------------------------------------

resource "azurerm_communication_service" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-communication"
  resource_group_name = azurerm_resource_group.lake_maple.name

  # Data residency for Communication Services.
  data_location = "United States"

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Email Communication Service
# ---------------------------------------------------------

resource "azurerm_email_communication_service" "lake_maple" {
  name                = "${var.project_name}-${var.environment}-email"
  resource_group_name = azurerm_resource_group.lake_maple.name

  data_location = "United States"

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Azure Managed Email Domain
# ---------------------------------------------------------

resource "azurerm_email_communication_service_domain" "lake_maple" {
  name             = "AzureManagedDomain"
  email_service_id = azurerm_email_communication_service.lake_maple.id

  domain_management = "AzureManaged"

  tags = {
    project     = "lake-maple"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------
# Connect Email Domain to Communication Services
# ---------------------------------------------------------

resource "azurerm_communication_service_email_domain_association" "lake_maple" {
  communication_service_id = azurerm_communication_service.lake_maple.id
  email_service_domain_id  = azurerm_email_communication_service_domain.lake_maple.id
}