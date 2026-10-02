const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const fixture = {response_code:0, results:Array.from({length:5}, (_, i) => ({
  type:'multiple', difficulty:'easy', category:encodeURIComponent('Science: Computers'),
  question:encodeURIComponent(i % 2 === 0
    ? `Question ${i + 1}: ${'Consider how a browser displays a document with text and interactive controls. '.repeat(12)}Which language runs in the browser?`
    : `Question ${i + 1}: Which language runs in the browser?`),
  correct_answer:'JavaScript', incorrect_answers:['SQL', 'Bash', 'Assembly']
}))};
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
  try {
    for (const viewport of [{width:1440,height:800}, {width:390,height:844}]) {
      const page = await browser.newPage({viewport});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/quiz?*', route => route.fulfill({json:{quiz:fixture,meta:{source:'proxy',count:5}}}));
      await page.goto(baseUrl);
      await page.locator('[data-action="start"]').click();
      await page.locator('#question-title').waitFor();
      await page.evaluate(() => document.fonts.ready);

      // Complete the challenge with two wrong answers so review also has a next question.
      for (let index = 0; index < 5; index++) {
        await page.locator('.answer-option').filter({hasText:index < 2 ? 'SQL' : 'JavaScript'}).click();
        await page.locator('[data-action="submit"]').click();
        const next = page.locator('[data-action="next"]');
        await next.scrollIntoViewIfNeeded();
        if (index < 4) {
          await next.evaluate(button => button.addEventListener('pointerdown', () => {window.beforeNextY = scrollY;}, {once:true}));
          await next.click();
          await settle(page);
          const position = await page.evaluate(() => ({before:window.beforeNextY, after:scrollY, focus:document.activeElement.id}));
          assert.ok(position.before > 0, 'The test must start from a scrolled viewport');
          assert.ok(Math.abs(position.after - position.before) <= 1, JSON.stringify({viewport,index,...position}));
          assert.equal(position.focus, 'question-title');
          if (index === 0) {
            // Selection and submission must not discard the scroll space retained for the shorter question.
            await page.locator('.answer-option').filter({hasText:'SQL'}).evaluate(button => button.click());
            await page.locator('[data-action="submit"]').evaluate(button => button.click());
            await settle(page);
            assert.ok(Math.abs(await page.evaluate(() => scrollY) - position.before) <= 1);
          }
        } else {
          await next.click();
          await settle(page);
          assert.equal(await page.evaluate(() => scrollY), 0);
          assert.equal(await page.locator('#app').evaluate(element => element.style.minHeight), '');
        }
        // The second answer was already submitted by the long-to-short persistence check.
        if (index === 0) {
          const nextShort = page.locator('[data-action="next"]');
          await nextShort.focus();
          const before = await page.evaluate(() => scrollY);
          await page.keyboard.press('Enter');
          await settle(page);
          assert.ok(Math.abs(await page.evaluate(() => scrollY) - before) <= 1);
          index++;
        }
      }

      await page.locator('[data-action="review"]').click();
      await page.locator('.answer-option').filter({hasText:'JavaScript'}).click();
      await page.locator('[data-action="submit"]').click();
      const nextReview = page.locator('[data-action="next"]');
      await nextReview.scrollIntoViewIfNeeded();
      await nextReview.focus();
      const reviewY = await page.evaluate(() => scrollY);
      await page.keyboard.press('Enter');
      await settle(page);
      assert.ok(reviewY > 0);
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - reviewY) <= 1);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.matches('.answer-option')), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${viewport.width}px: mouse/keyboard next, long-to-short, selection/submission, review, result reset`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
