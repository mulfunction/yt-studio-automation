# YouTube Studio Playwright Automation

Automates the daily downloading of the "Views by Content" CSV from YouTube Studio Advanced Mode using Playwright.

## Prerequisites
- Node.js installed

## Setup Instructions

1. **Install Dependencies**
   Run `npm install` in this directory to install Playwright and dotenv.
   Then run `npx playwright install chromium` to install the required browser binaries.

2. **Configure Target URL**
   Copy `.env.example` to `.env` and fill in your exact `STUDIO_URL`. To get this, navigate to YouTube Studio -> Analytics -> Advanced Mode -> Content Tab in your normal browser and copy the URL.

3. **Authenticate**
   Run `npm run setup`. This will open a Chrome window.
   Log into your Google account and navigate to YouTube Studio.
   Once you're fully logged in and can see your dashboard, return to the terminal and press `Enter`.
   This saves your authenticated session to `auth.json`.

## Usage

**Manual Run**
Run `npm run download`. The script will run headlessly in the background and download the CSV to the `downloads/` folder.

**Automated Daily Run (Windows)**
Right-click `schedule.ps1` and select "Run with PowerShell" to automatically register a Windows Scheduled Task that will run `npm run download` every day at 9:00 AM. (You can edit the `schedule.ps1` to change the time).
