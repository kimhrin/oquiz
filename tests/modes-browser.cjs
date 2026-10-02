// Public UI uses Proxy; Mock and Direct adapters are covered by gateway.test.mjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const {MOCK_DATA}=await import('../dist/data.js');let quizRequest;
  await page.route('**/api/quiz?*',r=>{quizRequest=r.request();return r.fulfill({json:{quiz:MOCK_DATA,meta:{source:'proxy',count:5,difyStatus:'succeeded',upstreamHttpStatus:200}}});});
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');
  assert.equal(await page.locator('[data-mode]').count(),0);
  assert.equal(await page.locator('.source-panel').count(),0);
  assert.equal(await page.locator('.note-badge').count(),0);
  await page.locator('[data-category="18"]').click();await page.locator('[data-difficulty="medium"]').click();
  await page.locator('[data-action="start"]').click();await page.locator('#question-title').waitFor();
  assert.equal(quizRequest.method(),'GET');assert.equal(quizRequest.headers().authorization,undefined);
  assert.equal(new URL(quizRequest.url()).searchParams.get('category'),'18');
  assert.equal(new URL(quizRequest.url()).searchParams.get('difficulty'),'medium');
  assert.match(await page.locator('.provenance').textContent(),/Proxy/);
  console.log('PASS: clean public home, Proxy by default, filters and no browser key.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
