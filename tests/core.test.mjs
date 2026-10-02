import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuestions, scoreAnswers, saveResult, readHistory, STORAGE_KEY } from '../dist/core.js';
const rows=Array.from({length:5},(_,i)=>({type:'multiple',difficulty:'easy',category:'Science%3A%20Computers',question:encodeURIComponent(`Question ${i}: "π & <code>"?`),correct_answer:encodeURIComponent('A & B'),incorrect_answers:['C','D','E']}));
test('encoded text remains text and each question has one correct answer in stable shuffled options',()=>{
 const q=normalizeQuestions(rows,()=>0.3);
 assert.equal(q[0].question,'Question 0: "π & <code>"?');
 assert.equal(q[0].correct,'A & B');
 for(const question of q){assert.equal(question.answers.filter(a=>a.correct).length,1);assert.equal(new Set(question.answers.map(a=>a.id)).size,4);}
 assert.equal(q[0].answers.length,4);
});
test('invalid or duplicate question payload is rejected',()=>{
 assert.throws(()=>normalizeQuestions(rows.slice(0,4)));
 assert.throws(()=>normalizeQuestions([...rows.slice(0,4),rows[0]]));
 assert.throws(()=>normalizeQuestions(rows.map(r=>({...r,correct_answer:'C'}))));
});
test('score is derived from answers including partial review rounds',()=>{
 assert.deepEqual(scoreAnswers([{correct:true},{correct:false},{correct:true},{correct:true},{correct:false}]),{correct:3,total:5,score:60});
 assert.equal(scoreAnswers([{correct:true}]).score,100);
 assert.equal(scoreAnswers([]).score,0);
});
test('history deduplicates the round, caps five records and handles corrupted storage',()=>{
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const record={id:'r1',date:'2026-10-02T05:00:00Z',category:'18',difficulty:'easy',correct:4,total:5,score:80};
 saveResult(storage,record);saveResult(storage,record);assert.equal(readHistory(storage).length,1);
 for(let i=2;i<9;i++)saveResult(storage,{...record,id:`r${i}`});
 assert.equal(readHistory(storage).length,5);assert.equal(readHistory(storage)[0].id,'r8');
 store.set(STORAGE_KEY,'invalid');assert.deepEqual(readHistory(storage),[]);
 assert.equal(saveResult({getItem:()=>null,setItem:()=>{throw Error();}},record),false);
});
