# Global Pipeline Manager v1.9.7

Hotfix for password recovery button and browser cache.

- Forgot password button now calls the recovery function directly.
- app.js and styles.css use versioned URLs to prevent the browser loading an older cached JavaScript file after deployment.
- Recovery action immediately shows Sending... and then a success/error message.
- No SQL/database migration required.

# Global Pipeline Manager v1.9.7

## v1.9.7
- Fixes Supabase password recovery flow.
- Recovery links now show a Set new password form instead of the normal sign-in form.
- Keeps persistent Supabase sessions (`persistSession` + automatic token refresh).
- Adds a Forgot password action on the login screen.
- Adds a visible app version in the login screen and sidebar.

## Deployment
For an existing v1.9.x installation, replace only:
- `index.html`
- `app.js`
- `styles.css`

Keep your existing `config.js`. No database migration is required for v1.9.7.

# Global Pipeline Manager v1
Upload index.html, styles.css, app.js and config.js to the root of Bartek-Global.
Run supabase_schema.sql once in Supabase SQL Editor.

Security note: this prototype allows anonymous read/write/delete access to prospects so a small group can use it without login. Do not store confidential information until authentication is added.

Premium principle options: turnover, outstanding balance, TPE based, other.


## v1.2
Adds dashboard filters, deadline views, country/manager/broker/status dashboards, richer autocomplete, and summary CSV exports.
Run migration_v1_2.sql in Supabase SQL Editor before uploading the frontend files.

## v1.3
- Acceptance rate field
- Opportunity type: New Business / Retender / Renewal / Expansion / Other
- Closed date
- Company table so one company can have multiple opportunities over time
- PDF offer/document uploads using Supabase Storage
- Multiple documents per opportunity with version/description support

### Upgrade
1. Run migration_v1_3.sql in Supabase SQL Editor
2. Upload index.html, styles.css, app.js and config.js to GitHub
3. Wait for GitHub Pages deployment and refresh with Ctrl+F5

Note: the offers bucket is public in this prototype and anonymous users with the site/API link can access it.

## v1.3.1 hotfix
Fixes saving an open opportunity when Closed date is blank.
Blank date fields are now sent to Supabase as NULL instead of an empty string.
Blank Acceptance rate is also stored as NULL rather than 0.

## v1.4
Adds Calendar Reminder without any email service or backend:
- Remind me in: number
- Unit: Days / Weeks / Months
- Time defaults to 09:00
- Reminder note
- Live calculated calendar date
- Add to Outlook Calendar downloads a standard .ics calendar event
- Calendar event contains prospect, policy, customer, broker, manager, status, opportunity type, acceptance rate and remarks

No Supabase migration is required when upgrading from v1.3.

## v1.4.1 hotfix
Fixes the Prospects table header alignment after adding Acceptance rate and Opportunity type.
No Supabase changes are required.

## v1.4.2
Usability improvements:
- Edit/Delete moved to the first column of the Prospects table.
- Actions column is sticky on the left while horizontally scrolling.
- Saving a prospect now closes the prospect dialog automatically.
- The separate Cancel click after Save is no longer needed.

No Supabase changes are required.

## v1.4.3
Tab autocomplete improvement:
- Type a unique beginning of an existing value, e.g. `sw`
- Press Tab
- The field expands to `Switzerland`
- Focus then moves normally to the next field
- Works for Customer country, Global country, Sales Manager, Broker, Broker contact and KAU
- If more than one existing value matches the typed prefix, the app does not guess

No Supabase changes are required.

## v1.4.4
Expected premium is now calculated automatically.
- No Calculate premium button
- Recalculates live when Insurable turnover changes
- Recalculates live when Premium rate changes
- Formula: Insurable turnover × Premium rate / 100
- If either field is blank, Expected premium stays blank

No Supabase changes are required.

## v1.4.5
Fixes and usability:
- Expected premium now recalculates automatically and reliably whenever Insurable turnover or Premium rate changes.
- Expected premium is read-only because it is system-calculated.
- Prospect table columns can now be rearranged by dragging their headers.
- Your chosen column order is saved in the browser and restored after refresh.
- Actions remains fixed on the far left for quick Edit/Delete access.
- No Supabase changes are required.

## v1.4.6
Autocomplete expanded across all reusable text fields:
- Prospect name
- Policy ID
- Customer ID
- Customer country
- Global country
- Sales Manager
- Broker
- Broker contact
- Key Account Underwriter (KAU)

Behavior:
- type the start of a known value, e.g. `sw`
- press Tab -> `Switzerland`
- if there is no prefix match, a unique contained match can also complete
- unique matches also complete on blur/clicking into the next field
- existing company names are also used for Prospect name suggestions

No Supabase changes are required.

## v1.4.7
Files are now visible directly in the Prospects list:
- New Files column next to Actions
- If an opportunity has documents, a paperclip icon shows the file count
- Clicking the icon opens a lightweight Files window without entering Edit
- File name, type, description and upload date are shown
- Clicking the file name opens the PDF
- The file count refreshes after uploading or deleting a document

No Supabase changes are required.

## v1.4.8
Prospect rows are now color-coded by status:
- Open / Ongoing: light green
- Won: slightly stronger green
- Lost: light red
- Other statuses: neutral white
- Hover states remain readable
- A colored strip on the left reinforces the status visually

No Supabase changes are required.

## v1.5.0 - currencies and whole-unit number formatting

Financial amounts now use spaces as thousands separators and no cents.

Example:
- 700000000 -> 700 000 000
- 392000 -> 392 000

Currency handling:
- Default currency is EUR.
- User can select another currency.
- Latest FX to EUR is fetched automatically from Frankfurter (ECB-based rates where available).
- The FX field remains editable as a fallback or if you want to use a commercial/tender-specific rate.
- The app stores the original amount in the selected currency and the normalized EUR amount.
- Dashboard totals remain comparable because they are summed in EUR.

Prospects table now shows:
- Currency
- Insurable turnover in entered currency
- Turnover EUR
- Premium rate
- Expected premium in entered currency
- Expected premium EUR

Important:
- Policy ID and Customer ID are identifiers and are therefore NOT reformatted as numbers.
- Percentage fields keep decimals because 0.056% and 87.5% must not be rounded to whole numbers.

Run migration_v1_5.sql once in Supabase before using this version.

## v1.5.1 - column alignment hotfix

Fixes the column/header misalignment introduced after adding the new currency columns.

Root cause:
- the saved draggable header order could be restored before prospect rows were rendered;
- rows were then rendered in the default order while headers remained in the user's saved order.

Fix:
- every prospect-table cell now has a stable column key;
- newly rendered rows are always rearranged to the actual header order;
- custom drag-and-drop column order is preserved;
- sorting/refreshing/filtering no longer causes values to appear under the wrong headers.

No Supabase changes are required beyond the v1.5.0 migration.

## v1.5.2 - definitive table alignment fix

The previous version still had several Prospect cells without stable column keys.
That allowed only part of a row to be moved, which shifted values under the wrong headers.

This version:
- assigns a stable key to every Prospect column and cell;
- never partially reorders a row;
- clears the obsolete corrupted saved column layout from older versions;
- starts again in the correct default order;
- keeps drag-and-drop column reordering from the clean layout onward.

No Supabase changes are required.

## v1.5.3 - FX conversion fix

The automatic FX lookup was using an obsolete Frankfurter endpoint.
It has been updated to the current Frankfurter v2 endpoint:

- selecting USD, CHF, PLN, GBP, etc. now fetches the latest rate to EUR automatically;
- the FX field is populated automatically;
- Turnover EUR and Expected premium EUR are recalculated immediately;
- if the FX call ever fails temporarily, clicking/focusing the empty FX field retries automatically;
- comma decimal input is also accepted, e.g. `0,1` is treated as `0.1`.

No Supabase changes are required.

## v1.5.4 - indicative FX workflow

- Keeps the free automatic FX source for pipeline-level EUR normalization.
- FX rate is explicitly labelled as indicative.
- Shows the rate date when returned by the FX source.
- EUR is shown as the base currency with FX = 1.
- Saved non-EUR opportunities show that the saved FX rate is editable.
- If automatic FX is unavailable, the app clearly asks for a manual indicative rate.
- All EUR pipeline calculations continue to use the saved FX rate for each opportunity.

No Supabase changes are required.

## v1.5.5
Added Policy start date as the expected inception/start date of the opportunity.
It is available in New/Edit Prospect and as a draggable column in the Prospects list.

Run migration_v1_5_5.sql once in Supabase.

## v1.5.6 - clearer status colours

Prospect row colours now distinguish pipeline state more clearly:
- Open / Ongoing: very light amber/yellow
- Won: light green
- Lost: light red
- Other statuses: white

Only CSS changed. No database, JavaScript or column-order changes.

## v1.5.7 - clickable dashboard / drill-through

Dashboard elements now open the underlying Prospects list:
- Total prospects
- Open
- Won
- Lost
- Overdue
- Due within 7 days
- Expected premium
- Insurable turnover
- Customer country bars
- Sales Manager bars
- Broker bars
- Status bars
- Individual rows in Deadlines requiring attention

The drill-through preserves the current dashboard selection, including filters such as Global country and Deadline.
A banner above the Prospects list shows what was selected and how many prospects are included.
Use `Clear selection` to return to the normal Prospects list.

No Supabase changes.
No Prospect table columns were added, removed or reordered.

## v1.6.0 - Pipeline Board
Added a Kanban Pipeline Board to the left sidebar.
Stages: Lead, Precheck, Quoting, Offer submitted, Negotiation, Won, Lost.
Cards can be dragged between stages and clicked to edit. Existing Open/On hold/Closed records remain compatible; non-Won/Lost legacy active records initially appear in Lead on the board until assigned a more specific pipeline stage.
No Supabase migration and no Prospect table column changes.

## v1.6.1 - Pipeline Board ordering

Default Pipeline Board order is now:
- Expected premium EUR, highest first.

A new Board Order selector supports:
- Premium high -> low (default)
- Deadline soonest
- Manual

Manual ordering:
- Drag a card above another card to place it there.
- Drag a card into empty space in a stage to place it at the bottom.
- Any manual drag automatically switches the board to Manual order.
- Manual order is stored in Supabase so all users see the same ordering.
- Moving cards between pipeline stages still updates Status and Closed date.

Run migration_v1_6_1.sql once in Supabase.
No Prospects table display columns were added or reordered.

## v1.7.0
Modern sidebar with live My Work badges, Policy Starts, Documents, Reports and Pipeline Snapshot. No Supabase migration and no Prospect table column changes.

## v1.8.0 - Security
- Supabase Auth magic-link login.
- No public account creation from the app (`shouldCreateUser: false`).
- `allowed_users` whitelist with `admin` / `user` role.
- Anonymous database access removed through RLS + grants.
- No insecure local-data fallback if the database is unavailable.
- Offers bucket becomes private.
- Files use signed URLs valid for 10 minutes.
- Admin can delete; User can read/create/update.
- Sign out is available in the sidebar.

Run `migration_v1_8_security.sql` once after configuring Auth and inviting the first user.

## v1.8.1 - Admin Users
Adds an Admin - Users page inside the application.

Admin can:
- see all whitelisted users
- add access
- change User/Admin role
- block or reactivate access

Important: this manages the application whitelist only. It does not create Supabase Auth accounts. A new person still needs an account in Supabase Authentication → Users.

Run `migration_v1_8_1_admin_users.sql` once.

## v1.8.2 - Email + password login

Changed authentication from Magic Link to normal email/password sign-in.

Benefits:
- no email is sent for each login,
- avoids the built-in Supabase email rate limit during normal use,
- existing RLS, whitelist, roles and private Storage remain unchanged,
- browser session remains persisted until sign-out.

Important:
- Existing Auth users must have a password set in Supabase Authentication.
- New users should be created/invited in Supabase Authentication, then added to the app whitelist in Admin - Users.
- No SQL migration is required for this version.

## v1.9.0 - Tasks & Reminders
- Native Tasks section in the sidebar.
- Live counts for Open, Overdue, Today and This week.
- Manual reminders inside each saved prospect.
- Date, time, type, assignee and note.
- Done / Reopen workflow.
- Automatic reminders for active opportunities:
  - 7 days after prospect creation,
  - 7 days before Offer deadline,
  - 2 days before Offer deadline.
- Automatic reminders are de-duplicated.
- Existing Outlook calendar reminder remains unchanged.

Run `migration_v1_9_reminders.sql` once before deploying this version.

This version provides in-app reminders. Background email notifications while the browser/app is closed require a scheduled backend/email sender and are intentionally left for a later version.


v1.9.7: password recovery boot-lock fix. Recovery links are detected before Supabase consumes the URL, preventing the reset form from being replaced by the normal login screen.


v1.9.7: fixes the post-login layout so the sidebar and main dashboard render side-by-side inside appShell.


v1.9.7: Dashboard Open, Overdue and Due within 7 days now use all active pipeline stages (Open, Lead, Precheck, Quoting, Offer submitted, Negotiation, Ongoing), matching Pipeline Board and drill-through logic.
