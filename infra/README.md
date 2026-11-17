# Azure infrastructure draft

For the deployed Atlas, see [Azure operations and backups](OPERATIONS.md).

Milestone 0 deliverable for review. Deployment and the cost review belong to Milestone 2.

The template uses UK South, a Consumption app at zero minimum replicas, Azure SQL Basic and private Hot LRS Blob Storage. SQL, Container Apps usage, Blob storage, transactions and egress can incur charges. See [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing) and [Azure SQL pricing](https://azure.microsoft.com/en-gb/pricing/details/azure-sql-database/single/).

## Before deployment approval

- Compile the template with `az bicep build --file infra/main.bicep` and run ARM what-if in the approved subscription.
- Supply a digest-pinned image, subscription, separate resource group, single-tenant Entra app registration, tenant ID, owner object ID and migration principal. Supply the Entra secret via a secure parameter. The registration needs an exact callback of `https://<host>/.auth/login/aad/callback`.
- In the app registration, open **Authentication** and enable **ID tokens (used for implicit and hybrid flows)**. Container Apps requests an ID token during browser sign-in. The CLI equivalent is `az ad app update --id <application-client-id> --enable-id-token-issuance true`.
- Use the client credential's **Value** field for `entraClientSecret`. If you rotate it, update the `entra-client-secret` Container Apps secret, restart the active revision and use the current credential for future Bicep deployments.
- Decide the SQL connectivity rules from the app and migration runner. The template opens no SQL firewall rule. Restrict traffic to approved ingress paths and avoid a broad Azure-services exception.
- Keep `enablePublicIngress` false for the initial deployment. Confirm Easy Auth is enabled, the owner and tenant are correctly configured, the app listens behind Easy Auth only, and no container port is reachable directly. If using a custom domain, set `ORIGIN` to that exact HTTPS origin and update the Entra callback.

## Approved rollout

1. Apply the schema using `npm run migrate` with a migration principal. An example connection string for the Entra-authenticated migration runner is `Server=<host>;Database=atlas;Encrypt=true;Authentication=Active Directory Integrated`.
2. As the SQL administrator, create the contained database user for the runtime managed identity. Give it `DEFAULT_SCHEMA = dog_statues` and grant only `SELECT, INSERT, UPDATE, DELETE` on `dog_statues.statues`, `dog_statues.media_assets` and `dog_statues.instagram_publications`. Blob data access is scoped by the template to the private container.
3. Confirm the trusted boundary is configured, then expose external ingress. Verify immediately that Microsoft sign-in works for the allowlisted owner and that other tenants/accounts and forged identity headers get no owner access. Validate public browsing anonymously.
4. Verify upload limits and cold starts, register the backup and spending alerts, and document recovery. Use a dedicated disposable resource group for development. When decommissioning an approved dev deployment, export its data, verify the resource group contains only disposable resources, then delete that group through Azure.

References for review include [Container Apps authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication), [Entra configuration](https://learn.microsoft.com/en-us/azure/container-apps/authentication-entra) and the [SQL Database resource schema](https://learn.microsoft.com/en-us/azure/templates/microsoft.sql/2023-08-01/servers/databases).
## Adding another project to the shared database

Give each app a distinct managed identity and schema. For example, run the following as the SQL administrator in `atlas` after creating the new app identity. Replace the example names for your project.

```sql
CREATE SCHEMA another_project AUTHORIZATION dbo;
GO
CREATE USER [another-project-runtime] FROM EXTERNAL PROVIDER
  WITH DEFAULT_SCHEMA = another_project;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::another_project
  TO [another-project-runtime];
```

Use the new identity in the new app and qualify its migration tables and objects with its own schema. Run schema changes using the migration identity. Keep each project's runtime permissions within its schema. Azure SQL Basic's 2 GB and 5 DTUs are shared. Point-in-time restores cover the whole database, so restore to a separate target before recovering data for one project.
