# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project
**קהילת מבשר ציון** — PWA for a synagogue community in Tel Mond, Israel. Deployed via GitHub Pages at `https://spivakjon.github.io/mevaser-zion/`.

## Architecture
- **Single-file app:** all code lives in `index.html` (~6,400 lines). CSS ~17–734, HTML ~735–1290, JS ~1291–end.
- **No build tools, no frameworks, no npm.** Vanilla HTML + CSS + ES6 JS.
- **Persistence:** `localStorage` (primary) + optional Google Sheets sync via `apps-script.gs`.
- **PWA:** `sw.js` (service worker, cache `mbz-v1`, network-first for Hebcal APIs, cache-first for assets) + `manifest.json`.
- **Deploy:** push to `master` → GitHub Pages updates in ~30s.

## Key files
| File | Purpose |
|------|---------|
| `index.html` | Entire application |
| `sw.js` | Service Worker (offline support) |
| `manifest.json` | PWA manifest (RTL, standalone) |
| `apps-script.gs` | Google Apps Script endpoint for Sheets sync |
| `qr.html` | QR-code registration page |
| `stats.html`, `test-sync.html` | Aux pages |
| `README.md` | Extensive Hebrew user/admin docs |

## Admin
- Password: `Nir2026` (const `PW` around line ~1283)
- Access via "🔒 ניהול" button

## Geo (Tel Mond)
- Coords: `32.258°N, 34.917°E`
- Used by KosherZmanim v0.9.0 for candle-lighting / havdalah

## External APIs
- Hebcal converter / calendar / shabbat — 6h cache in `mbz_hc_cache`, `mbz_cal_cache`, `mbz_week_cache`
- KosherZmanim (local, no network)
- Chabad.org.il (parasha reading links)

## i18n
- `I18N.he` / `I18N.en` dictionaries (~180+ keys)
- `data-i18n` / `data-i18n-placeholder` / `data-i18n-text` attributes
- `T('key')` in JS
- HTML-containing keys (with `<br>` etc.) are special-cased in `applyLang()`: currently `welcomeText`, `successBody`, `mbrPromptText`, `payFairnessText`
- Admin can override texts via Settings → saved to `mbz_custom_texts`

## Theme
- Dark (default) + Light, toggled via button, saved to `mbz_theme`
- CSS vars: `--bg1:#1a2744`, `--bg2:#1c3a4a`, `--gold:#c8a84b`, `--gold2:#ddb95e`, `--grn:#1e7d4b`, `--red:#c0392b`

## localStorage keys
`mbz_v5` (members), `mbz_aliyot`, `mbz_kiddush`, `mbz_announcements`, `mbz_duty_queue`, `mbz_duty_history`, `mbz_duty_swaps`, `mbz_custom_duties`, `mbz_duty_last_adv`, `mbz_theme`, `mbz_lang`, `mbz_custom_texts`, `mbz_custom_logo`, `mbz_vol_types`, `mbz_custom_tags`, `mbz_hc_cache`, `mbz_cal_cache`, `mbz_week_cache`, `mbz_show_daily_times`, `mbz_msg_renew`, `mbz_msg_overdue`, `mbz_membership`, `mbz_sheets_url`.

## Registration flow
1. User clicks "📝 הרשמה" → `toggleReg()`
2. Membership-dues prompt shows: *"אנו שמחים לרשום את פרטי המתפלל לשנת {year}. האם שולמו דמי החבר?"*
3. **Yes** → `membershipAnswer(true)` opens the form
4. **No** → `membershipAnswer(false)` shows `payment-msg-card` with fairness note + payment links + "אסדיר את התשלום בהמשך" button → `showFormAnyway()` opens the form

Year comes from `mbz_membership.year` (default: `תשפ״ו`).

## Admin dashboard (9 tabs)
1. לוח שבועי (12 weeks)
2. מתפללים (search/filter/sort/import/export)
3. עליות/קידוש
4. מודעות
5. חברות (payment tracking + WhatsApp templates with `{name}`/`{year}`/`{link}`)
6. תורנויות (fairness rotation, 2/Shabbat, swaps, holiday auto-assign)
7. יארצייטים (filter by Hebrew month)
8. מתנדבים
9. טבלה מלאה

## Key JS functions
- Storage: `lsGet`, `lsSet`
- Members CRUD: `addM`, `updM`, `delM`, `getM`
- Rendering: `renderCal`, `renderML`, `renderStats`, `renderPublicAnnouncements`
- Tabs: `showAt(tab)`
- Dates: `g2h`, `h2g` (Hebcal)
- i18n: `applyLang`, `T`, `mergeCustomTexts`
- Registration: `toggleReg`, `initForm`, `submitForm`, `resetForm`, `membershipAnswer`, `showFormAnyway`, `initMbrPrompt`
- Member detail: `showMemberDetail`, `doEditMx`
- Sheets: `sheetsPost`, `sheetsLoadAll`

## Conventions & gotchas
- **Single-file edits only** — don't split into modules; the app is intentionally one HTML file.
- **No new dependencies.** No npm, no bundlers.
- **Hebrew RTL is default.** Always preserve `dir="rtl"` behaviour; English LTR is handled by `applyLang()`.
- **iOS quirks:** `font-size: 16px` on inputs (prevents zoom), `min-height: 44px` on buttons, `safe-area-inset` for notch.
- **Hebcal API:** avoid Adar Aleph (ה-API מכניס לא נכון לפי הערת המשתמש).
- **Israeli ID validation:** Luhn mod 10 — on new registrations only.
- **Rate limit:** max 3 registrations/hour via `sessionStorage`.
- **Duty roster:** only Shabbat & holidays (never weekdays), 2 per Shabbat, fairness-based rotation.
- **Week cache versioning:** bump `WK_CACHE_VER` to invalidate stale caches after render changes.

## Adding a form field
1. Add `<input>` inside `<div id="fv">`
2. Update `submitForm()` — collect the value
3. Update `initForm()` — load on edit
4. Update `showMemberDetail()` — display
5. Update `resetForm()` — clear
6. Optional: add to `exportExcel()` and `importExcel()`

## Adding a translation
1. Add `data-i18n="myKey"` to the HTML element
2. Add the key to both `I18N.he` and `I18N.en`
3. If the value contains HTML (`<br>`, `<strong>`), also add the key to the innerHTML branch in `applyLang()`

## Git
- Main branch: `master`
- Commits: write in the existing English imperative style (see `git log`)
- Never force-push, never skip hooks
- Only commit when explicitly asked

## Contact
Developer: Yehonatan (Jonatan) Spivak (יהונתן ספיבק)
Community contact: Nir Kaufman — 054-8882150
