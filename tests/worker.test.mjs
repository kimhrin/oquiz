import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('file-origin requests receive CORS on health and missing-key errors',async()=>{
  for(const [route,status] of [['/api/health',200],['/api/quiz?category=18&difficulty=easy',503]]){
    const r=await worker.fetch(new Request('https://oquiz.test'+route,{headers:{Origin:'null'}}),{});
    assert.equal(r.status,status);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'*');
    const body=await r.json();if(status===503)assert.equal(body.error.code,'DIFY_NOT_CONFIGURED');
  }
  const preflight=await worker.fetch(new Request('https://oquiz.test/api/quiz',{method:'OPTIONS',headers:{Origin:'null'}}),{});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'*');
});
test('worker validates filters before network and serves a complete single HTML',async()=>{
  const bad=await worker.fetch(new Request('https://oquiz.test/api/quiz?category=https://evil.test'),{});
  assert.equal(bad.status,400);
  const page=await worker.fetch(new Request('https://oquiz.test/oquiz.html'),{});
  const html=await page.text();assert.match(html,/<!doctype html>/i);assert.ok(html.includes('getQuizQuestions'));assert.ok(!html.includes('src="./app.js"'));
  assert.match(page.headers.get('Content-Disposition'),/oquiz.html/);
});
