# ✨ Magic Stamp Passport

A Disney-inspired digital employee passport where employees collect magical stamps for
participating in company activities, trainings, CSR programs, wellness campaigns, and
special achievements — then redeem stamps for rewards.

**Stack:** HTML5 / CSS3 / JavaScript · Bootstrap 5 · Font Awesome · Google Sheets ·
Google Apps Script Web App · GitHub Pages

---

## 1. Folder structure

```
magic-stamp-passport/
├── index.html              # redirects to login.html
├── login.html               # employee / manager sign-in
├── employee.html             # employee portal (passport, history, rewards)
├── hr.html                  # HR / manager portal (grant stamps, approvals, analytics)
├── css/
│   └── style.css             # Disney-inspired design system
├── js/
│   ├── api.js                # fetch wrapper for the Apps Script Web App
│   ├── auth.js                # login + session handling
│   ├── employee.js             # employee portal logic
│   └── hr.js                  # HR portal logic
├── apps-script/
│   └── Code.gs                # Google Apps Script backend (deploy as Web App)
├── images/
│   ├── stamps/
│   │   └── stamp-default.svg   # default stamp graphic shown in stamp history
│   └── rewards/
│       └── reward-placeholder.svg  # fallback image when a reward has no photo
└── README.md
```

---

## 2. Google Sheet setup guide

This project is wired to match your existing workbook
(`ระบบสมุดแสตมป์สำหรับพนักงาน 3.xlsx`). Upload it to Google Sheets (or open it directly
in Google Sheets) and confirm it has these five tabs with these exact header rows in row 1.
`Code.gs` reads columns **by header name**, so column order doesn't matter, but the header
text must match exactly.

### Sheet: `Employee`
| รหัสพนักงาน | ชื่อ-นามสกุล | แผนก | ตำแหน่ง | Plant | คำนำหน้า | ชื่อ | นามสกุล |
|---|---|---|---|---|---|---|---|

> Total stamps are **not** stored here — they're computed live from the `Data` sheet so
> the number is always accurate even if someone edits history rows by hand.

### Sheet: `Managers`
| รหัสพนักงาน | ชื่อ-นามสกุล | แผนก | PIN | ตำแหน่ง | Plant | คำนำหน้า | ชื่อ | นามสกุล | ApproverType | Email |
|---|---|---|---|---|---|---|---|---|---|---|

- `PIN` is the manager's sign-in PIN (kept as a plain sheet value — see **Security
  Recommendations** below for hardening options).
- `ApproverType` should be `HR` or `Manager`. Both can grant stamps and approve
  redemptions; the value is shown in the HR portal header for clarity and can be used to
  gate future permission tiers.
- Optional column `ActiveStatus` (`Active` / `Inactive`) can be added to disable an
  account without deleting the row.

### Sheet: `Data` (stamp transaction ledger)
| Timestamp | รหัสพนักงาน | ชื่อ-นามสกุล | แผนก | กิจกรรม | จำนวนแสตมป์ | ผู้ให้แสตมป์ | รหัสผู้ให้ | หมายเหตุ |
|---|---|---|---|---|---|---|---|---|

Every stamp grant **and** every redemption appends a row here (redemptions are logged as
a negative `จำนวนแสตมป์`), so this sheet is the single source of truth for an employee's
balance and full history.

### Sheet: `Rewards`
| RewardID | ชื่อของรางวัล | แสตมป์ที่ใช้แลก | จำนวนคงเหลือ | สถานะ | รูปภาพ |
|---|---|---|---|---|---|

- `สถานะ` is `Active` or `Disabled`.
- `รูปภาพ` is an image URL (optional — a placeholder icon is shown if blank).
- An optional `Description` (or `คำอธิบาย`) column can be added for reward blurb text.

### Sheet: `Redemptions`
| RedemptionID | Timestamp | รหัสพนักงาน | ชื่อพนักงาน | RewardID | ชื่อของรางวัล | แสตมป์ที่ใช้ | สถานะ | ผู้ดำเนินการ | หมายเหตุ |
|---|---|---|---|---|---|---|---|---|---|

`สถานะ` starts as `Pending` and becomes `Approved` or `Rejected` from the HR portal.
Rejections automatically refund the employee's stamps and restock the reward.

---

## 3. Apps Script deployment guide

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Delete the default `Code.gs` boilerplate and paste in the contents of
   `apps-script/Code.gs` from this project.
3. Click **Save**, then **Deploy → New deployment**.
4. Click the gear icon next to "Select type" → choose **Web app**.
5. Configure:
   - **Description:** Magic Stamp Passport API
   - **Execute as:** *Me* (your account — so the script can read/write the sheet)
   - **Who has access:** *Anyone* (required for the static site to call it; see
     Security Recommendations for tightening this)
6. Click **Deploy**, authorize the requested permissions, and copy the **Web app URL**
   (it ends in `/exec`).
7. Open `js/api.js` in this project and replace `YOUR_DEPLOYMENT_ID` in `WEB_APP_URL`
   with your deployed URL.
8. Whenever you edit `Code.gs`, you must create a **new deployment version**
   (Deploy → Manage deployments → Edit → New version) for changes to take effect on the
   existing `/exec` URL.

---

## 4. GitHub Pages deployment guide

1. Create a new GitHub repository (e.g. `magic-stamp-passport`).
2. Push the contents of this folder to the repository root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Magic Stamp Passport"
   git branch -M main
   git remote add origin https://github.com/<your-org>/magic-stamp-passport.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`, branch
   `main`, folder `/ (root)`.
5. Save — GitHub will publish the site at
   `https://<your-org>.github.io/magic-stamp-passport/`.
6. Confirm `js/api.js` points at your deployed Apps Script URL *before* pushing, since
   this is a static site (no server-side build step).

---

## 5. Local development

No build tools required — it's static HTML/CSS/JS. To preview locally with working
`fetch` calls, serve the folder instead of opening the file directly (`file://` origins
can be blocked by some browsers):

```bash
cd magic-stamp-passport
python3 -m http.server 8080
# then open http://localhost:8080/login.html
```

---

## 6. Adding your own images

The app displays two kinds of images, both loaded from local folders in the project so
you don't need any image hosting:

### Reward photos — `images/rewards/`
1. Drop your reward photos into `images/rewards/` (e.g. `mug.jpg`, `voucher.png`).
2. In the **Rewards** sheet, put just the **filename** in the `รูปภาพ` column
   (e.g. `mug.jpg`) — the app automatically resolves it to `images/rewards/mug.jpg`.
3. You can also paste a **full URL** instead (`https://...`) if you'd rather host the
   image elsewhere — the app detects `http(s)://` and uses it as-is without the folder
   prefix.
4. Leave `รูปภาพ` blank to fall back to the built-in `reward-placeholder.svg`.
5. In the HR portal's **Manage Rewards → Add/Edit** form, a live thumbnail preview
   appears under the image field as you type.
6. If a file is missing or the URL is broken, the image quietly falls back to the
   placeholder instead of showing a broken-image icon.

### Stamp graphic — `images/stamps/`
- Every earned stamp in the employee's history list shows the same graphic:
  `images/stamps/stamp-default.svg`. Replace that file with your own artwork (keep the
  filename, or update `STAMP_IMAGE_DEFAULT` in `js/employee.js` if you rename it) to
  reskin the stamp icon across the whole app in one place.
- If the image ever fails to load, it falls back to a Font Awesome stamp icon so the
  layout never breaks.

> Tip: keep reward photos roughly square (e.g. 400×400) and under ~200KB so the reward
> cards and thumbnails load quickly — GitHub Pages serves these as static files, so
> there's no server-side resizing.

### About the stamp collection album

The employee portal renders earned stamps as a real multi-page book
(`js/employee.js` → `buildStampbookPages`): a front cover (name + total stamps), then
numbered pages with exactly 6 postage-stamp slots each, and a back cover. Pages are
flipped two at a time (left/right spread) with the **แผ่นก่อน / แผ่นถัดไป** buttons.
Change `STAMPS_PER_BOOK_PAGE` in `js/employee.js` if you want a different number of
stamps per page. Redemption/refund ledger entries (negative stamp amounts) are filtered
out of the album automatically — only positively-earned stamps are collectible.

---

## 7. Achievement levels

Defined identically in `js/employee.js` and `apps-script/Code.gs` — update both if you
change the thresholds:

| Level | Thai | Stamps required |
|---|---|---|
| Explorer | นักสำรวจ | 0 |
| Dreamer | นักฝัน | 10 |
| Adventurer | นักผจญภัย | 25 |
| Hero | วีรบุรุษ | 50 |
| Legend | ตำนาน | 100 |

---

## 8. Security recommendations

- **PIN storage:** Manager PINs are currently plain values in the `Managers` sheet for
  simplicity. For production, consider hashing PINs (e.g. with a salted SHA-256 computed
  in Apps Script via `Utilities.computeDigest`) and storing only the hash.
- **Web app access:** "Anyone" access is required for a public GitHub Pages front end to
  reach the Apps Script endpoint, since Apps Script Web Apps don't support custom CORS
  headers. To reduce risk:
  - Rate-limit or log suspicious call volume using `PropertiesService` / `CacheService`.
  - Never expose the raw Apps Script URL outside the employee-facing app.
  - Consider moving to a small Cloud Function / Firebase proxy in front of the sheet if
    you need IP allow-listing or stronger auth (e.g. SSO) later.
- **Input validation:** `Code.gs` validates employee/manager existence, stamp amounts,
  reward stock, and balance sufficiency server-side — never trust the client alone even
  though the front end also validates for UX.
- **Employee ID as the only employee credential:** Employee IDs are treated as
  identifiers, not secrets — anyone who knows a colleague's ID can currently view (but
  not spend) their passport. If this is a concern, add a PIN or SSO login for the
  employee portal too.
- **Audit trail:** Every stamp grant, redemption, and refund is appended to `Data` /
  `Redemptions` with a timestamp and actor name — don't allow direct row edits/deletes by
  non-admins in the underlying Sheet's sharing settings.
- **Sheet sharing:** Keep the Google Sheet itself restricted to HR/IT; the web app is the
  only intended read/write path for regular users.

---

## 9. Future enhancement suggestions

- Google SSO (Workspace) login instead of manual Employee ID entry.
- Push/email notifications when stamps are granted or redemptions are approved.
- Bulk stamp-granting via CSV upload for large events.
- Manager-scoped views (a manager only sees their own department's employees).
- Badge/achievement gallery with unlockable storybook-style illustrations per level.
- Seasonal "passport pages" (quarterly themes) with limited-time reward sets.
- Export dashboard analytics to PDF/Sheets for monthly HR reporting.
- Progressive Web App (installable, offline-friendly) wrapper for mobile use.

---

## 10. Support

For questions about this system, contact your HR/IT administrator. This is an internal
employee engagement tool — please do not expose the Apps Script Web App URL publicly
outside company channels.
