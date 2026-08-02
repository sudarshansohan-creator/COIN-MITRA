import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', error => {
    console.log('BROWSER EXCEPTION:', error.message);
  });

  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle2', timeout: 10000 });
    console.log('Page loaded.');
  } catch (err) {
    console.log('Error navigating:', err.message);
  }

  await browser.close();
})();
