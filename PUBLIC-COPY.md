# Reviewing public wording

Edit the text values in [public-copy.json](src/lib/public-copy.json). This is the list of shared website wording for the homepage, navigation, statue page template, error page and RSS feed, including the homepage search description and the fallback photo description. The homepage introduction and search description are separate fields so you can write each for its audience. Preserve the space at the end of the fallback photo prefix if you keep a prefix.

For wording about an individual statue, use **Owner area → All statues → open a statue**. Review the name, short summary, website description, photo alt text and credit. The homepage and RSS reuse the name and summary. The Instagram preview uses the website description and adds a location line, so review the final caption there before you publish. Existing published records update when saved.

Preview changes to the shared wording locally with `npm.cmd run dev` and open [the local homepage](http://127.0.0.1:5173/). Check a public statue page, `/rss.xml`, and a missing page as relevant. The owner-area install name is in [manifest.webmanifest](static/manifest.webmanifest).

For each Codex change, ask for a public wording review. The review should show the exact old and proposed text, the page or state where each line appears, and every place it is reused. You can supply your own words in the chat or edit the file yourself. Review the final diff with `git diff -- src/lib/public-copy.json`, or use **Files changed** in a GitHub pull request. Keep that review with the release so you can trace when wording changed.

The repository instructions tell Codex to obtain your approval before committing proposed wording. The production image build is manually triggered. The instructions provide a review process, and GitHub enforcement would require branch rules or a protected release environment.
