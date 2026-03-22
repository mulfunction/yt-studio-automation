const { chromium } = require('playwright');
const path = require('path');
require('dotenv').config();

(async () => {
    console.log('Launching browser for authentication setup...');
    
    // Use a persistent context directory so the session stays intact across script runs
    const userDataDir = path.join(__dirname, 'userdata');
    
    // Launch a visible browser so the user can log in
    const context = await chromium.launchPersistentContext(userDataDir, { 
        headless: false 
    });
    
    // launchPersistentContext naturally opens a page, so we grab that instead of opening a new one
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    console.log('\n======================================================');
    console.log('ACTION REQUIRED:');
    console.log('1. A new browser window has opened.');
    console.log('2. Log in to your Google Account and pass any 2FA checks.');
    console.log('3. Navigate to https://studio.youtube.com and ensure you are on your dashboard.');
    console.log('4. Once you are fully logged in AND on the Studio dashboard,');
    console.log('   return to this terminal and press ENTER to save your session.');
    console.log('======================================================\n');
    
    // Auto-navigate to studio home page
    await page.goto('https://studio.youtube.com');

    // Wait for user to press Enter in the console
    await new Promise(resolve => {
        process.stdin.once('data', () => {
            resolve();
        });
    });

    console.log('✅ Session saved to userdata! You can now run the automated download script.');

    await context.close();
    process.exit(0);
})();
