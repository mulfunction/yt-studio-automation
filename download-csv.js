const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const AdmZip = require('adm-zip');
require('dotenv').config();

const TARGET_URL = process.env.STUDIO_URL;
const HEADLESS = false; // Forced false to support safe, human-like clicks

if (!TARGET_URL) {
    console.error('❌ Error: STUDIO_URL environment variable is not set.');
    console.error('Please configure your .env file with the URL of the "Views by Content" Advanced Mode page.');
    process.exit(1);
}

const userDataDir = path.join(__dirname, 'userdata');
if (!fs.existsSync(userDataDir)) {
    console.error('❌ Error: userdata directory not found. Please run `node setup-auth.js` first to log in.');
    process.exit(1);
}

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

function sendToastNotification(message) {
    // Create a robust PowerShell script and encode it as base64 to avoid quoting issues
    const safeMessage = message.replace(/'/g, "''").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const psCommand = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast><visual><binding template="ToastText01"><text id="1">YouTube Studio Automator Error</text><text id="2">${safeMessage}</text></binding></visual></toast>')
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("YT Studio Auto").Show($toast)
`;
    const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
    
    exec(`powershell -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`, (err) => {
        if (err) console.error('Failed to send toast notification:', err.message);
    });
}

(async () => {
    console.log('🚀 Starting YouTube Studio CSV Automation...');
    
    // Launch persistent context
    const context = await chromium.launchPersistentContext(userDataDir, { 
        headless: HEADLESS,
        args: ['--start-maximized'],
        acceptDownloads: true,
        viewport: null
    });
    
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    try {
        console.log(`Navigating to ${TARGET_URL}...`);
        
        await page.goto(TARGET_URL, { waitUntil: 'commit', timeout: 60000 }).catch(e => console.log('goto timed out or blocked, continuing anyway...'));
        
        // Handle "Unsupported Browser" block from YouTube Studio
        try {
            const skipButton = page.getByRole('link', { name: /Skip to YouTube Studio/i });
            await skipButton.waitFor({ state: 'visible', timeout: 5000 });
            console.log('Bypassing "unsupported browser" warning...');
            await skipButton.click();
        } catch (e) {
            // Expected if not intercepted
        }

        console.log('Waiting for YouTube Studio data table to load...');
        try {
            await page.waitForSelector('[aria-label*="Export"], [aria-label*="Download"]', { state: 'visible', timeout: 30000 });
            
            console.log('UI shell loaded. Ensuring no loading spinners are visible (table rendering)...');
            // Check that YouTube's custom spinners aren't active
            await page.waitForFunction(() => {
                return document.querySelectorAll('tp-yt-paper-spinner[active], .skeleton-bg').length === 0;
            }, { timeout: 60000 }).catch(() => console.log('Spinner check timed out, proceeding anyway...'));

            console.log('Adding 5-second final safety buffer...');
            await page.waitForTimeout(5000);
        } catch (e) {
            console.log('Elements not found, throwing error to trigger notification...');
            throw new Error('Data table did not render in time. You may have been logged out or the page is taking too long to load.');
        }

        console.log('Looking for Export button...');
        const exportButton = page.locator('[aria-label="Export current view"], [aria-label*="Export"], [aria-label*="Download"]').first();
        await exportButton.waitFor({ state: 'visible', timeout: 30000 });
        
        console.log('Clicking Export button...');
        await exportButton.hover();
        await page.waitForTimeout(500 + Math.random() * 500); // 500-1000ms delay
        await exportButton.click({ delay: 100 + Math.random() * 100 }); // Hold click for 100-200ms
        
        console.log('Setting up download listener (up to 2 minutes for large Lifetime exports)...');
        const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
        
        console.log('Triggering CSV export...');
        const csvOption = page.locator('tp-yt-paper-item').filter({ hasText: /Comma/i }).first();
        await csvOption.waitFor({ state: 'visible', timeout: 10000 });
        await csvOption.hover();
        await page.waitForTimeout(500 + Math.random() * 500); // 500-1000ms delay
        await csvOption.click({ delay: 100 + Math.random() * 100 }); // Hold click for 100-200ms
        
        console.log('Waiting for the file to download...');
        const download = await downloadPromise;
        
        const date = new Date();
        const timestamp = date.toISOString().split('T')[0]; 
        const suggestedFilename = download.suggestedFilename();
        const ext = path.extname(suggestedFilename) || '.csv';
        const finalFilename = `views_by_content_${timestamp}${ext}`;
        
        const downloadPath = path.join(downloadsDir, finalFilename);
        
        console.log('Saving file...');
        await download.saveAs(downloadPath);
        
        console.log(`✅ Success! File downloaded to: ${downloadPath}`);

        if (ext.toLowerCase() === '.zip') {
            console.log('Archive detected. Extracting contents...');
            const extractPath = path.join(downloadsDir, `views_by_content_${timestamp}`);
            
            if (!fs.existsSync(extractPath)) {
                fs.mkdirSync(extractPath);
            }
            
            try {
                const zip = new AdmZip(downloadPath);
                zip.extractAllTo(extractPath, true);
                console.log(`✅ Successfully extracted ZIP into: ${extractPath}`);
            } catch (err) {
                console.error('❌ Failed to extract zip file:', err.message);
            }
        }

    } catch (error) {
        console.error('❌ Automation failed:', error.message);
        
        sendToastNotification(`YT Studio Automation Failed: ${error.message.substring(0, 50)}... Please check logs or re-authenticate.`);

        const errorScreenshotPath = path.join(__dirname, 'error-screenshot.png');
        await page.screenshot({ path: errorScreenshotPath, fullPage: true }).catch(e => console.log('Could not save screenshot:', e.message));
        console.log(`Saved screenshot to ${errorScreenshotPath} for debugging.`);

        const html = await page.content().catch(e => '');
        if (html) {
            fs.writeFileSync(path.join(__dirname, 'error-page.html'), html);
            console.log(`Saved HTML to error-page.html for debugging.`);
        }
        
        process.exitCode = 1;
    } finally {
        console.log('Closing browser context...');
        await context.close();
    }
})();
