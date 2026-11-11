# Operate Dog Statue Atlas on Azure

Production is in the `dog-atlas-prod` resource group. The app is `dogatlas-app`, the database is `atlas` on `dogatlas-kgbflh3dgddsc.database.windows.net`, and the private photo container is `atlas` in `dogatlaskgbflh3dgddsc`. The deployed app uses those two Azure stores.

## Back up the catalogue

Take the first backup after creating your first real Azure record, then take one weekly while the catalogue is active and before schema changes. Keep a separate encrypted copy off this PC. Eight weekly copies and six monthly copies are a reasonable starting point. Use a daily schedule if a week's edits would be too much to recreate.

1. [Install SqlPackage for Windows](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-download#installation-file-download-alternative). The standalone ZIP can be extracted into a tools folder. Add that folder to PATH or substitute the full path to `SqlPackage.exe` in the command below.
2. Sign in to Azure CLI and select the Atlas subscription. For SQL, use your Entra SQL administrator account and confirm the SQL server firewall allows your current public IPv4 address. For photos, open storage account **dogatlaskgbflh3dgddsc → Containers → atlas → Access control (IAM)** and give your backup account **Storage Blob Data Reader** on that container if needed. Allow time for the role assignment to propagate.
3. Wait for edits and uploads to finish, then leave the editor idle until both copies finish. Run this block in PowerShell. Choose a private backup location outside the checkout.

```powershell
$backupRoot = Read-Host 'Full path to your private backup folder'
$backup = Join-Path $backupRoot "atlas-$(Get-Date -Format yyyyMMdd-HHmmss)"
$photos = Join-Path $backup 'media'
New-Item -ItemType Directory -Path $photos -Force -ErrorAction Stop | Out-Null

$sql = 'Server=tcp:dogatlas-kgbflh3dgddsc.database.windows.net,1433;Database=atlas;Authentication=Active Directory Interactive;Encrypt=True;Connection Timeout=90'
$bacpac = Join-Path $backup 'atlas.bacpac'
SqlPackage /Action:Export "/SourceConnectionString:$sql" "/TargetFile:$bacpac"
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $bacpac)) { throw 'SQL export failed.' }

az storage blob download-batch --account-name dogatlaskgbflh3dgddsc --auth-mode login --source atlas --destination $photos --output none
if ($LASTEXITCODE -ne 0) { throw 'Photo download failed.' }

$image = az containerapp show -g dog-atlas-prod -n dogatlas-app --query 'properties.template.containers[0].image' -o tsv
if ($LASTEXITCODE -ne 0 -or !$image) { throw 'Could not record the deployed image.' }
@(
    "Completed UTC $((Get-Date).ToUniversalTime().ToString('o'))"
    "Image $image"
    "BACPAC SHA256 $((Get-FileHash -LiteralPath $bacpac).Hash)"
    "Photo files $((Get-ChildItem -LiteralPath $photos -File -Recurse | Measure-Object).Count)"
) | Set-Content -LiteralPath (Join-Path $backup 'backup-info.txt') -ErrorAction Stop
```

Sign in with your Azure SQL administrator when SqlPackage opens the Microsoft prompt. A successful backup folder contains `atlas.bacpac`, `media/` and `backup-info.txt`. Check the reported photo file count against the container and open a backed-up image. Files under `media` keep the `statue ID/photo ID/variant` paths. Backups contain private notes and original photos. Keep them in private storage. [SQL export consistency](https://learn.microsoft.com/en-us/azure/azure-sql/database/database-export) · [Azure CLI blob commands](https://learn.microsoft.com/en-us/cli/azure/storage/blob#az-storage-blob-download-batch)

## Recover data

- **Recent SQL mistake.** In Azure SQL, use **Restore** to recover to a point just before the mistake in a separate database. The current free configuration retains seven days. Check pricing for a restore target because Azure cannot restore into the free offer. Compare the recovered rows with production before deciding what to recover. [Azure SQL recovery](https://learn.microsoft.com/en-us/azure/azure-sql/database/recovery-using-backups) · [Free offer limits](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer-faq)
- **Recent photo deletion.** Use **Show deleted blobs** in the Azure container and undelete the affected blob within the seven-day retention window. Container soft delete covers deletion of the whole container and is currently disabled. To add it, open the storage account's **Data protection** settings, enable **soft delete for containers** with a retention period you choose, and mirror the setting in Bicep before the next infrastructure deployment. [Blob soft delete](https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-blob-overview) · [Container soft delete](https://learn.microsoft.com/en-us/azure/storage/blobs/soft-delete-container-overview)
- **Test a full recovery.** Import one backup BACPAC into a separate empty SQL database using SqlPackage and upload its `media` files to a separate private container, preserving the paths. Approve any restore resources and charges first. Point a test instance at the restored stores, confirm record and photo counts, and open a draft and a published gallery. Keep production pointed at the original stores throughout the drill. Record the date and result and repeat after major schema changes. [Import a BACPAC](https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import)

## Maintain the deployment

| When | What to check |
| --- | --- |
| Weekly | Confirm the latest paired backup completed. Check owner sign-in and an anonymous public page. |
| Monthly | Review Cost Management and the SQL **Free amount remaining** metric. Set actual and forecast budget alerts. The free SQL configuration pauses until the next month when its allowance is exhausted. [Azure budget alerts](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets) |
| Before changing code | Run `npm.cmd run check` and `npm.cmd test`, record the current production image digest, then commit and run **Publish Atlas image** in GitHub Actions. Apply any matching SQL migration after backing up, then deploy the new digest and test sign-in, upload and public display. For an app-only update use `az containerapp update -g dog-atlas-prod -n dogatlas-app --image $image`, with `$image` set to the new digest. A previous digest can roll back an app-only update. Check schema compatibility before rolling back a release with a database change. |
| Before the Entra client secret expires | The current credential expires **11 May 2027**. Rotate it in April 2027, update `entra-client-secret` in Container Apps, restart the active revision and test a fresh owner login. Supply the current value on future Bicep deployments. |

For routine diagnosis, start with [healthz](https://dogatlas-app.politegrass-75f2f83c.uksouth.azurecontainerapps.io/healthz), then check Container Apps **Revisions and replicas** and the console or system log stream. A healthy process can still have a SQL, Blob or sign-in problem. For a SQL outage, check the database status and quota, then compare the current Container Apps outbound IPs with the SQL firewall rules.
