import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '11111111-1111-4111-8111-111111111111'::uuid $$;
 CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='true' $$;
 CREATE TABLE auth.users(id uuid,email_confirmed_at timestamptz);
 CREATE TABLE bkash_payments(trx_id text,amount numeric,created_at timestamptz,user_id uuid,status text,environment text,coupon_code text);
 CREATE TABLE analytics_events(event_name text,user_id uuid,created_at timestamptz,page_path text,page_url text,referrer text);
 CREATE TABLE meta_capi_events(event_name text,status text,created_at timestamptz);
 CREATE TABLE subscriptions(status text,starts_at timestamptz,ends_at timestamptz);
 INSERT INTO bkash_payments VALUES
 ('A',349,now(),auth.uid(),'completed','live',null),('A',349,now(),auth.uid(),'completed','live',null),
 ('B',100,now(),auth.uid(),'completed','live',null),('T',1,now(),auth.uid(),'completed','live','PLTEST1'),
 ('S',5,now(),auth.uid(),'completed','sandbox',null),('F',12,now(),auth.uid(),'failed','live',null),
 (null,1990,now(),auth.uid(),'initiated','live',null),('OLD',50,now()-interval '1 day',auth.uid(),'completed','live',null);
 INSERT INTO auth.users VALUES(auth.uid(),now()),(auth.uid(),now()),(auth.uid(),null);
 INSERT INTO analytics_events VALUES
 ('page_view',auth.uid(),now(),'/','https://www.proshnolab.com/','https://l.facebook.com/?private=secret'),
 ('page_view',null,now(),'/pricing','https://www.proshnolab.com/pricing',null),
 ('page_view',auth.uid(),now(),'/admin','https://www.proshnolab.com/admin',null),
 ('page_view',null,now(),'/','http://localhost:8080/',null),
 ('begin_checkout',auth.uid(),now(),'/pricing','https://www.proshnolab.com/pricing',null);
 INSERT INTO meta_capi_events VALUES('Lead','sent',now()),('Lead','pending',now()),('CompleteRegistration','sent',now());
 INSERT INTO subscriptions VALUES('active',now()-interval '1 day',now()+interval '1 day'),('active',now()-interval '2 days',now()-interval '1 day');
`);
await db.exec(await readFile('supabase/migrations/20261014220000_marketing_dashboard.sql','utf8'));
await db.exec('SET ROLE anon');
await assert.rejects(db.query('SELECT admin_marketing_overview(1)'));
await db.exec('SET ROLE authenticated');
await assert.rejects(db.query('SELECT admin_marketing_overview(1)'));
await db.exec("RESET ROLE; SET test.admin='true'; SET ROLE authenticated");
const result=(await db.query('SELECT admin_marketing_overview(1) AS result')).rows[0].result;
assert.equal(Number(result.revenue),449);
assert.equal(Number(result.previous_revenue),50);
assert.equal(result.purchases,2);
assert.equal(result.buyers,1);
assert.equal(result.signups,2);
assert.equal(result.page_views,2);
assert.equal(result.pricing_views,1);
assert.equal(result.checkouts,1);
assert.equal(result.active_users,1);
assert.equal(result.pending_payments,1);
assert.equal(result.failed_payments,1);
assert.equal(result.active_subscriptions,1);
assert.equal(result.leads_sent,1);
assert.equal(result.leads_pending,1);
assert.equal(result.daily.length,1);
assert.equal(Number(result.daily[0].revenue),449);
assert.equal(result.sources.some(s=>s.source==='l.facebook.com'),true);
assert.equal(JSON.stringify(result).includes('private=secret'),false);
assert.equal((await db.query('SELECT admin_marketing_overview(999) AS result')).rows[0].result.days,7);
console.log('Marketing dashboard: permission boundaries, live/test filtering, transaction deduplication, day ranges, aggregates and referrer privacy passed.');
await db.close();
