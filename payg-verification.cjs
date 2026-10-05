const fs = require('fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('supabase/functions/_shared/payg.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod = {exports:{}}; new Function('exports','module',compiled)(mod.exports,mod);
const {preparePayg,questionRate} = mod.exports;
const rows = {chapters:[{id:1,name:'Chapter',subject_id:2}],subjects:[{id:2,name:'Math',class_id:3}],classes:[{id:3,name:'Class 8'}]};
function database(){return {from(table){let type;return {select(){return this},in(){return this},eq(field,value){if(field==='type')type=value;return this},order(){return this},range(){return Promise.resolve({data:Array.from({length:type==='cq'?2:60},(_,i)=>({id:i+(type==='cq'?1000:type==='short'?2000:3000)}))})},then(resolve){return Promise.resolve({data:rows[table]}).then(resolve)}}}};}
(async()=>{
 assert.equal(questionRate('cq'),100);assert.equal(questionRate('short'),25);assert.equal(questionRate('paragraph'),25);
 const order=await preparePayg(database(),{chapter_ids:[1],counts:{mcq:40,short:20,cq:2}});
 assert.equal(order.price,17);assert.equal(order.question_ids.length,62);assert.equal(new Set(order.question_ids).size,62);
 await assert.rejects(preparePayg(database(),{chapter_ids:[1],counts:{cq:3}}),/Not enough/);
 for(const count of [0,-1,1.5,201])await assert.rejects(preparePayg(database(),{chapter_ids:[1],counts:{mcq:count}}),/Invalid/);
 console.log('PASS: rates, ৳17 order, exact reservation, availability and count validation');
})().catch(e=>{console.error(e);process.exitCode=1});
