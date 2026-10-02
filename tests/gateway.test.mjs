import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDifyGateway, parseWorkflow, validateFilters} from '../scripts/dify-gateway.mjs';
import {MOCK_DATA, getQuizQuestions} from '../dist/data.js';
const success = () => ({data:{status:'succeeded',outputs:{upstream_http_status:200,result:JSON.stringify(MOCK_DATA)}}});
test('input whitelist rejects arbitrary URL injection, duplicate filters and unsupported fields',()=>{
  assert.deepEqual(validateFilters(new URLSearchParams()),{category:'any',difficulty:'easy'});
  for(const q of ['category=https://example.com','category=18&category=9','difficulty=extreme','url=https://example.com']) assert.throws(()=>validateFilters(new URLSearchParams(q)),{code:'PARAMETER'});
});
test('Dify POST uses server key, published blocking contract and maps all category to any',async()=>{
  let seen;
  const api=createDifyGateway({env:{DIFY_API_KEY:'app-test-secret'},fetchImpl:async(url,options)=>{seen={url,options};return {status:200,ok:true,json:async()=>success()};}});
  const result=await api.run(new URLSearchParams());
  assert.equal(seen.url,'https://api.dify.ai/v1/workflows/run');
  assert.equal(seen.options.headers.Authorization,'Bearer app-test-secret');
  assert.deepEqual(JSON.parse(seen.options.body),{inputs:{category:'any',difficulty:'easy'},response_mode:'blocking',user:'oquiz-local-user'});
  assert.equal(result.quiz.results.length,5);assert.equal(result.meta.difyStatus,'succeeded');
  assert.ok(!JSON.stringify(result).includes('app-test-secret'));
});
test('redirects are never followed with the Dify credential',async()=>{
  let calls=0;
  const api=createDifyGateway({env:{DIFY_API_KEY:'app-test-secret'},fetchImpl:async(url,options)=>{
    calls++;assert.equal(options.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://other.example/workflows/run'}});
  }});
  await assert.rejects(api.run(new URLSearchParams()),{code:'DIFY_HTTP'});
  assert.equal(calls,1);
});
test('workflow success is checked separately from upstream HTTP and data quality',()=>{
  assert.throws(()=>parseWorkflow({data:{status:'failed',error:'do not expose'}}),{code:'DIFY_WORKFLOW'});
  const upstream=success();upstream.data.outputs.upstream_http_status=500;
  assert.throws(()=>parseWorkflow(upstream),{code:'UPSTREAM_HTTP'});
  const limited=success();limited.data.outputs.result=JSON.stringify({response_code:5,results:[]});
  assert.throws(()=>parseWorkflow(limited),{code:'RATE',status:429});
  const invalid=success();invalid.data.outputs.result=JSON.stringify({response_code:0,results:[]});
  assert.throws(()=>parseWorkflow(invalid),{code:'INVALID_DATA'});
});
test('missing configuration makes no request; Dify authentication and timeout are classified',async()=>{
  let calls=0;
  const missing=createDifyGateway({env:{},fetchImpl:()=>{calls++;throw Error();}});
  await assert.rejects(missing.run(new URLSearchParams()),{code:'DIFY_NOT_CONFIGURED'});assert.equal(calls,0);
  for(const [status,code] of [[401,'DIFY_AUTH'],[404,'DIFY_NOT_PUBLISHED'],[429,'RATE']]){
    const api=createDifyGateway({env:{DIFY_API_KEY:'app-test'},fetchImpl:async()=>({status,ok:false})});
    await assert.rejects(api.run(new URLSearchParams()),{code});
  }
  const timeout=createDifyGateway({env:{DIFY_API_KEY:'app-test'},fetchImpl:async()=>{throw Object.assign(Error(),{name:'TimeoutError'});}});
  await assert.rejects(timeout.run(new URLSearchParams()),{code:'DIFY_TIMEOUT'});
});
test('gateway spaces upstream calls to respect OpenTDB IP limit',async()=>{
  let clock=10000,calls=0;
  const api=createDifyGateway({env:{DIFY_API_KEY:'app-test'},now:()=>clock,fetchImpl:async()=>{calls++;return {status:200,ok:true,json:async()=>success()};}});
  await api.run(new URLSearchParams());await assert.rejects(api.run(new URLSearchParams()),{code:'RATE'});assert.equal(calls,1);
  clock+=6000;await api.run(new URLSearchParams());assert.equal(calls,2);
});
test('Mock works offline and all adapters return the same five-question shape',async()=>{
  const mock=await getQuizQuestions({mode:'mock',fetchImpl:()=>{throw Error('Network not allowed');}});
  assert.equal(mock.questions.length,5);assert.equal(mock.meta.source,'mock');
  let seen;
  const direct=await getQuizQuestions({mode:'direct',category:'18',difficulty:'easy',fetchImpl:async(url)=>{seen=url;return {status:200,ok:true,json:async()=>MOCK_DATA};}});
  const url=new URL(seen);assert.equal(url.searchParams.get('encode'),'url3986');assert.equal(url.searchParams.get('amount'),'5');
  const proxy=await getQuizQuestions({mode:'proxy',category:'18',difficulty:'easy',fetchImpl:async(url)=>{assert.ok(url.startsWith('/api/quiz?'));return {status:200,ok:true,json:async()=>({quiz:MOCK_DATA,meta:{difyStatus:'succeeded'}})};}});
  assert.deepEqual(mock.questions.map(q=>q.question),direct.questions.map(q=>q.question));
  assert.deepEqual(proxy.questions.map(q=>q.question),direct.questions.map(q=>q.question));
});
test('client preserves rate-limit layer and reports malformed text as invalid data',async()=>{
  const limited=()=>getQuizQuestions({mode:'proxy',difficulty:'easy',fetchImpl:async()=>({status:429,ok:false,json:async()=>({error:{code:'RATE'},meta:{source:'proxy',layer:'opentdb',responseCode:5}})})});
  await assert.rejects(limited,error=>error.message==='RATE'&&error.meta.layer==='opentdb'&&error.meta.responseCode===5);
  const invalid=structuredClone(MOCK_DATA);invalid.results[0].question='%ZZ';
  await assert.rejects(getQuizQuestions({mode:'direct',difficulty:'easy',fetchImpl:async()=>({status:200,ok:true,json:async()=>invalid})}),error=>error.message==='INVALID_DATA'&&error.meta.source==='direct');
});
