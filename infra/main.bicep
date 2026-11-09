targetScope = 'resourceGroup'

@minLength(3)
@maxLength(11)
@description('Lowercase letters and digits only. Combined with a unique suffix for global names.')
param prefix string = 'dogatlas'
param location string = 'uksouth'
@description('Approved, publicly pullable container image, preferably pinned by digest.')
param image string
@description('Microsoft Entra directory ID for the owner and app registration.')
param tenantId string = tenant().tenantId
param ownerObjectId string
param entraClientId string
@secure()
param entraClientSecret string
@description('Display name of the Entra principal that will apply database migrations.')
param sqlAdminName string
param sqlAdminObjectId string
@description('Enable only after confirming Easy Auth runs on all ingress paths.')
param enablePublicIngress bool = false

var suffix = uniqueString(resourceGroup().id)
var appName = '${prefix}-app'
var sqlName = '${prefix}-${suffix}'
var blobContainer = 'atlas'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-runtime'
  location: location
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${prefix}${suffix}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource media 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: blobContainer
  properties: { publicAccess: 'None' }
}

resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(media.id, identity.id, 'blob-contributor')
  scope: media
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource server 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlName
  location: location
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'User'
      login: sqlAdminName
      sid: sqlAdminObjectId
      tenantId: tenantId
      azureADOnlyAuthentication: true
    }
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: server
  name: 'atlas'
  location: location
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
    requestedBackupStorageRedundancy: 'Local'
    maxSizeBytes: 34359738368
  }
}

resource environment 'Microsoft.App/managedEnvironments@2025-07-01' = {
  name: '${prefix}-env'
  location: location
  properties: {
    appLogsConfiguration: { destination: 'none' }
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
  }
}

resource app 'Microsoft.App/containerApps@2025-07-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: enablePublicIngress
        targetPort: 8080
        allowInsecure: false
        transport: 'auto'
      }
      secrets: [{ name: 'entra-client-secret', value: entraClientSecret }]
    }
    template: {
      containers: [
        {
          name: 'atlas'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AUTH_MODE', value: 'entra' }
            { name: 'ENTRA_TENANT_ID', value: tenantId }
            { name: 'ENTRA_ADMIN_OBJECT_ID', value: ownerObjectId }
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
            { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
            { name: 'AZURE_STORAGE_CONTAINER', value: media.name }
            { name: 'DATABASE_URL', value: 'Server=${server.properties.fullyQualifiedDomainName};Database=${database.name};Encrypt=true;Authentication=Active Directory Integrated;Client Id=${identity.properties.clientId}' }
            { name: 'ORIGIN', value: 'https://${appName}.${environment.properties.defaultDomain}' }
          ]
          probes: [{
            type: 'Liveness'
            httpGet: { path: '/healthz', port: 8080 }
          }]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

resource auth 'Microsoft.App/containerApps/authConfigs@2025-07-01' = {
  parent: app
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: { unauthenticatedClientAction: 'AllowAnonymous' }
    httpSettings: { requireHttps: true }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          clientSecretSettingName: 'entra-client-secret'
          openIdIssuer: uri(az.environment().authentication.loginEndpoint, '${tenantId}/v2.0')
        }
      }
    }
  }
}

output appHost string = app.properties.configuration.ingress.fqdn
output sqlHost string = server.properties.fullyQualifiedDomainName
output runtimeIdentityName string = identity.name
output runtimePrincipalId string = identity.properties.principalId
