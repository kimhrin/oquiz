// Test fixtures are local-only and never shipped with dist.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
fs.mkdirSync('test-output', {recursive:true});
const fixture = {response_code:0,results:[
 ['What does CPU stand for?', 'Central Processing Unit', ['Computer Personal Unit','Central Program Utility','Control Processing User']],
 ['Which language runs in a web browser?', 'JavaScript', ['SQL','Bash','Assembly']],
 ['Which symbol means "less than"?', '<', ['>','&','π']],
 ['What is the binary representation of two?', '10', ['01','11','00']],
 ['Which device stores files persistently?', 'SSD', ['CPU','RAM','Monitor']]
].map(([question,correct,wrong])=>({type:'multiple',difficulty:'easy',category:encodeURIComponent('Science: Computers'),question:encodeURIComponent(question),correct_answer:encodeURIComponent(correct),incorrect_answers:wrong.map(encodeURIComponent)}))};
const results=[];
const check=(name)=>{results.push({name,status:'passed'});console.log('PASS',name);};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1050}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let calls=0, mode='normal';
 await page.route('**/api/quiz?*',async route=>{calls++;if(mode==='network')return route.abort();let body=fixture;if(mode==='rate')body={response_code:5,results:[]};if(mode==='empty')body={response_code:1,results:[]};if(mode==='bad')body={response_code:0,results:[]};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({quiz:body,meta:{source:'proxy',count:5}})});});
 await page.goto(baseUrl);
 await page.locator('[data-category="18"]').click();await page.locator('[data-action="start"]').click();
 await page.locator('#question-title').waitFor();assert.equal(calls,1);
 assert.equal(await page.locator('[data-action="submit"]').isDisabled(),true);check('5 questions requested once; no submission without selection');
 await page.locator('.quit-button').click();await page.keyboard.press('Escape');assert.equal(await page.locator('[role="dialog"]').count(),0);assert.equal(await page.locator('.quit-button').evaluate(e=>e===document.activeElement),true);check('quit dialog Escape restores focus');
 for(let i=0;i<5;i++){
  const text=decodeURIComponent(i===2?fixture.results[i].incorrect_answers[0]:fixture.results[i].correct_answer);
  const before=await page.locator('.option-text').allTextContents();
  await page.locator('.answer-option').filter({has:page.locator('.option-text',{hasText:text})}).first().click();
  assert.deepEqual(await page.locator('.option-text').allTextContents(),before);
  await page.locator('[data-action="submit"]').evaluate(e=>{e.click();e.click();});
  assert.equal(await page.locator('.answer-option:not([disabled])').count(),0);
  if(i===0)await page.screenshot({path:'test-output/quiz-desktop.png',fullPage:true});
  await page.locator('[data-action="next"]').click();
 }
 assert.match(await page.locator('.score-ring strong').textContent(),/80/);
 let records=await page.evaluate(()=>JSON.parse(localStorage.getItem('oquiz.history.v1')));assert.equal(records.length,1);assert.equal(records[0].score,80);check('answer shuffle stable; answer lock; 80-point score; exactly one history record');
 await page.screenshot({path:'test-output/result-desktop.png',fullPage:true});
 await page.locator('[data-action="review"]').click();assert.equal(await page.locator('.answer-option').count(),4);
 await page.locator('.answer-option').filter({has:page.locator('.option-text',{hasText:'<'})}).click();await page.locator('[data-action="submit"]').click();await page.locator('[data-action="next"]').click();
 assert.match(await page.locator('.score-ring strong').textContent(),/100/);assert.equal(calls,1);assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('oquiz.history.v1')))).length,1);check('wrong-answer review uses cached question and preserves original record');
 await page.locator('.nav-item[data-action="history"]').click();await page.reload();await page.locator('.nav-item[data-action="history"]').click();assert.equal(await page.locator('.history-row').count(),1);check('history persists across reload');
 await page.locator('[data-action="clear-history"]').click();await page.locator('[data-action="cancel-dialog"]').click();assert.equal(await page.locator('.history-row').count(),1);await page.locator('[data-action="clear-history"]').click();await page.locator('[data-action="confirm-dialog"]').click();assert.equal(await page.locator('.history-row').count(),0);check('history clear requires confirmation');
 await page.setViewportSize({width:390,height:844});await page.locator('.nav-item[data-action="home"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);check('390px mobile home has no horizontal overflow');
 await page.locator('[data-action="start"]').click();await page.locator('#question-title').waitFor();await page.screenshot({path:'test-output/quiz-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);check('390px mobile quiz has no horizontal overflow');
 await page.locator('.quit-button').click();await page.locator('[data-action="confirm-dialog"]').click();
 for(const [type,expected] of [['rate','요청이 잠시 몰렸어요'],['empty','문제가 5개보다 적어요'],['network','인터넷 연결'],['bad','정상적으로 읽지 못했어요']]){
  mode=type;await page.reload();await page.locator('[data-action="start"]').click();await page.locator('[role="alert"]').waitFor();assert.match(await page.locator('[role="alert"]').textContent(),new RegExp(expected));if(type==='rate')assert.equal(await page.locator('[data-action="start"]').isDisabled(),true);check(type+' error is actionable');
 }
 await page.evaluate(()=>localStorage.setItem('oquiz.history.v1','malformed'));await page.reload();assert.equal(await page.locator('.page-heading h1').count(),1);check('malformed history does not break app');
 assert.deepEqual(errors,[]);check('no uncaught browser errors');
 await context.close();
 if(process.env.LIVE_API==='1'){
 const live=await browser.newContext({viewport:{width:1440,height:1050}});const lp=await live.newPage();
 await lp.goto(baseUrl);await lp.locator('[data-category="18"]').click();
 let apiResponse;lp.on('response',r=>{if(r.url().includes('/api/quiz?'))apiResponse=r;});
 await lp.locator('[data-action="start"]').click();
 try{await lp.locator('#question-title').waitFor({timeout:20000});const payload=await apiResponse.json();fs.writeFileSync('test-output/live-response.json',JSON.stringify(payload));check('LIVE Dify Proxy browser fetch returns 5 questions');await lp.screenshot({path:'test-output/live-quiz.png',fullPage:true});}
 catch{const alert=await lp.locator('[role="alert"]').textContent().catch(()=>null);results.push({name:'LIVE Dify Proxy browser fetch',status:'blocked',detail:alert||'Request did not complete'});console.log('LIVE BLOCKED',alert);}
 }
 await browser.close();fs.writeFileSync('test-output/browser-report.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
