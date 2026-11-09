# Dog Statue Atlas

A mobile-first owner workspace and public statue pages. This checkout covers Milestones 0 and 1. The database starts empty.

## Run locally on Windows

Use Node.js 24.15 or later in the 24.x series. Run these commands from the project directory.

```powershell
npm.cmd ci
Copy-Item .env.example .env
notepad .env
```

Set `LOCAL_ADMIN_PASSWORD` to a unique passphrase of at least 24 characters. Save the file, then run:

```powershell
npm.cmd run dev
```

Open [the owner sign-in](http://127.0.0.1:5173/admin) and use that passphrase. Vite prints the actual port. The first request that reads or writes records creates `.atlas/atlas.sqlite` and applies the local migration. Photos are stored under `.atlas/media/`. The browser needs JavaScript for the editor.

For real photos and notes you want to keep outside Dropbox sync, set `ATLAS_DATA_DIR` in `.env` to a local directory outside your Dropbox folder.

## Try the Android flow

For a quick simulation, use Chrome DevTools device mode at 393 × 851 CSS pixels. To use an Android phone's camera and system photo picker, stop the loopback server, connect both devices to a trusted Wi-Fi network and run:

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
ipconfig
```

Open `http://<computer-Wi-Fi-IPv4>:5173/admin` in Chrome on the phone. If Windows Firewall prompts, allow it on the private network. The HTTP development fixture is for test data on a trusted network. Use a trusted HTTPS origin to exercise Chrome's installed home-screen experience. The manifest and icons are supplied, and installation behavior depends on the browser and origin.

1. Tap **Add statue**. Select several JPEGs at once, or tap **Take photo**. Enter a quick private note and leave the name blank. The photos show individual progress while you type.
2. Wait for **Saved to Atlas**, then tap **Save draft**. Reopen the untitled record from the inbox. The text and photos should persist after a reload.
3. In the full editor, move a photo earlier or later and set the cover. Open **Photo details**, enter alt text and approve it for website display. Enter a name, city and country or both coordinates, and the public description.
4. Choose **Publish to website**, confirm, then open **View public page**. Try that URL in an incognito tab. The description and approved photos should appear.
5. Rename the record and let it autosave. The public link should stay the same. Change the visit status independently. Tap **Unpublish** and reload the public URL and photo URL in incognito. Both should return 404.
6. To exercise retries, turn off the connection while editing a field or uploading, then reconnect. Verify that the edited text stays in the tab and that a failed photo offers **Retry photo**. Browser refresh recovery covers text. Keep the tab open to retry the selected files.

Use your own test photos or clearly fictitious fixtures. Shut down the LAN server with Ctrl+C when done.

## Automated checks

```powershell
npx.cmd playwright install chromium
npm.cmd run check
npm.cmd run lint
npm.cmd test
```

To use already-installed Chrome, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` before running tests. The suite builds the production bundle, then uses an isolated SQLite database and filesystem under the ignored `test-results` directory with a development-only sign-in fixture. It runs in Chromium at Android and desktop viewport sizes. The test server uses port 4177.

## Optional local SQL Server and Azurite

Use a dedicated empty SQL Server database. Add a `DATABASE_URL` to `.env`, for example `Server=localhost,1433;Database=atlas;User Id=<local-user>;Password=<password>;Encrypt=true;TrustServerCertificate=true`. The latter certificate setting is for local testing. Run `npm.cmd run migrate` before starting the app. Leave the variable empty to use SQLite.

For Azurite, set `AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true`, start Azurite on its default ports and create a private blob container named `atlas` using its emulator connection in Storage Explorer. Change `AZURE_STORAGE_CONTAINER` if using another name. With both Blob settings unset, media uses local files.

## Local backup and recovery

Stop the local server before copying the entire `.atlas` directory, or the configured `ATLAS_DATA_DIR`. The directory contains private notes and original photos. Store the copy in private storage. To check recovery, set `ATLAS_DATA_DIR` to the copy, restart the app and open a draft and photo. Keep this directory outside `static/`. SQL Server and Blob users need backups of both stores. Owner exports and cloud recovery drills belong to the next milestone.

See [DECISIONS.md](DECISIONS.md) for the implementation choices and [the Azure infrastructure draft](infra/README.md) for the proposed deployment.
