import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE teachers(id uuid primary key,email text,full_name text);
CREATE TABLE institutes(id bigserial primary key,owner_id uuid,name text,phone text,division text,district text,upazila text,specific_address text,created_at timestamptz default now());
CREATE TABLE feedback(id bigserial primary key,teacher_id uuid,category text,subject text,details text,priority text,created_at timestamptz default now());

GRANT SELECT ON teachers, institutes,feedback TO service_role;`);
const sql=await readFile(new URL('../supabase/migrations/20261022144322_secure_telegram_notifications.sql',import.meta.url),'utf8');
await db.exec(sql.slice(0,sql.indexOf('-- Replace the public anon-key cron'))+'COMMIT;');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
await db.query("INSERT INTO teachers VALUES($1,'real@example.test','{}')",[owner]);
await db.query("INSERT INTO institutes(owner_id,name) VALUES($1,'Saved institute')",[owner]);
await db.query("INSERT INTO feedback(teacher_id,subject) VALUES($1,'Saved feedback'),($1,'Another feedback')",[owner]);
let checks=0;
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function claim(actor,event,record=null) {
 return (await db.query('SELECT claim_user_telegram_notification($1,$2,$3) result',[actor,event,record])).rows[0].result;
}
check(await claim(other,'new_registration',1),null);
check(await claim(owner,'payment_success'),null);
await db.exec('SET ROLE service_role');
let item=await claim(owner,'new_registration',1);
check(item.payload.fields[2].value,'Saved institute');
check((await claim(owner,'new_registration',1)).duplicate,true);
check((await claim(owner,'new_feedback',1)).rate_limited,true);
await db.query('SELECT record_user_telegram_delivery($1,$2,$3)',[item.id,item.lease_token,'chat-a']);
await db.exec('RESET ROLE; UPDATE user_telegram_notifications SET locked_until=now()-interval \'1 second\'; SET ROLE service_role;');
const retry=await claim(owner,'new_registration',1);
check(retry.delivered_chat_ids,['chat-a']);
assert.notEqual(item.lease_token,retry.lease_token);checks++;
await assert.rejects(db.query('SELECT finish_user_telegram_notification($1,$2)',[item.id,item.lease_token]));checks++;
await db.query('SELECT finish_user_telegram_notification($1,$2)',[retry.id,retry.lease_token]);
check((await claim(owner,'new_registration',1)).duplicate,true);
await db.exec("RESET ROLE; UPDATE user_telegram_notifications SET created_at=now()-interval '6 minutes'; SET ROLE service_role;");
item=await claim(owner,'new_feedback',1);
check(item.payload.fields[3].value,'Saved feedback');
check((await claim(owner,'new_feedback',2)).rate_limited,true);
await db.exec("RESET ROLE; UPDATE feedback SET created_at=now()-interval '2 days';");
check(await claim(owner,'new_feedback',1),null);
for(const role of ['anon','authenticated']){
 await db.exec('SET ROLE '+role);
 await assert.rejects(db.query('SELECT * FROM user_telegram_notifications'));checks++;
 await assert.rejects(db.query('SELECT claim_user_telegram_notification($1,$2,null)',[owner,'new_registration']));checks++;
 await assert.rejects(db.query("SELECT record_user_telegram_delivery(1,gen_random_uuid(),'chat')"));checks++;
 await assert.rejects(db.query("SELECT finish_user_telegram_notification(1,gen_random_uuid())"));checks++;
 await db.exec('RESET ROLE');
}
console.log('Notification security: '+checks+' SQL checks passed');
await db.close();
