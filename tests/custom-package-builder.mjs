import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const fixture = JSON.parse(await read('tests/fixtures/custom-package-catalog.json'));
const buyer = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
let checks = 0;
function check(actual, expected) { assert.deepEqual(actual, expected); checks++; }
async function reject(query, params = []) { await assert.rejects(db.query(query, params)); checks++; }

await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.role',true),''),'anon') $$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 CREATE FUNCTION public.has_role(id uuid,role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
 CREATE TABLE public.teachers(id uuid PRIMARY KEY);
 CREATE TABLE public.classes(id bigint PRIMARY KEY,name text);
 CREATE TABLE public.subjects(id bigint PRIMARY KEY,class_id bigint REFERENCES classes(id),name text,subject_code text);
 CREATE TABLE public.pricing_packages(id bigint PRIMARY KEY,type text,class_name text,subject_name text,price integer,is_active boolean,is_coming_soon boolean,subject_ids bigint[],duration_days integer,sort_order integer);
 CREATE TABLE public.bkash_payments(id bigserial PRIMARY KEY,user_id uuid,payment_id text UNIQUE,merchant_invoice_number text,amount numeric,discount numeric DEFAULT 0,coupon_code text,selected_packages jsonb,status text DEFAULT 'initiated',trx_id text,bkash_response jsonb,error_message text,payer_reference text,institute_name text,teacher_name text,teacher_email text,environment text);
 CREATE TABLE public.subscriptions(id bigserial PRIMARY KEY,teacher_id uuid REFERENCES teachers(id),plan text,status text,starts_at timestamptz,ends_at timestamptz,bkash_payment_id bigint REFERENCES bkash_payments(id));
 CREATE TABLE public.user_permissions(user_id uuid,class_id bigint,subject_id bigint);
 CREATE TABLE public.questions(id bigint PRIMARY KEY,class_id bigint,subject_id bigint,teacher_id uuid);
 CREATE TABLE public.saved_papers(id bigserial PRIMARY KEY,teacher_id uuid,question_ids bigint[]);
 CREATE TABLE public.coupon_counter(code text PRIMARY KEY,uses integer DEFAULT 0);
 CREATE FUNCTION public.increment_coupon_usage(coupon_code text) RETURNS void LANGUAGE sql AS $$ UPDATE coupon_counter SET uses=uses+1 WHERE code=coupon_code $$;
 ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
 CREATE POLICY "Teachers can read own subscription" ON subscriptions FOR SELECT TO authenticated USING(teacher_id=auth.uid());
 CREATE POLICY "Teachers can insert own subscription" ON subscriptions FOR INSERT TO authenticated WITH CHECK(teacher_id=auth.uid());
 GRANT SELECT,INSERT ON subscriptions TO authenticated;
 GRANT USAGE ON SEQUENCE subscriptions_id_seq TO authenticated;
`);
const bootstrap = await read('supabase/migrations/20260719163538_cc7f6f9e-d5a0-480c-ada2-f477ad3cc1c4.sql');
await db.exec(bootstrap.slice(bootstrap.indexOf('CREATE OR REPLACE FUNCTION public.normalize_subscription_text'), bootstrap.indexOf('CREATE OR REPLACE FUNCTION public.can_read_question')));
await db.query('INSERT INTO teachers VALUES($1),($2)', [buyer, other]);
for (const c of fixture.classes) await db.query('INSERT INTO classes VALUES($1,$2)', [c.id,c.name]);
for (const s of fixture.subjects) await db.query('INSERT INTO subjects VALUES($1,$2,$3,$4)', [s.id,s.class_id,s.name,s.subject_code]);
for (const p of fixture.packages) await db.query('INSERT INTO pricing_packages VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [p.id,p.type,p.class_name,p.subject_name,p.price,p.is_active,p.is_coming_soon,p.subject_ids,p.duration_days,p.sort_order]);
const fixedBefore = await db.query('SELECT * FROM pricing_packages ORDER BY id');
await db.exec(await read('supabase/migrations/20261012010000_custom_package_duration.sql'));
await db.exec(await read('supabase/migrations/20261012120000_custom_package_builder.sql'));
await db.exec(await read('supabase/migrations/20261012120100_custom_package_pricing_seed.sql'));
check((await db.query('SELECT * FROM pricing_packages ORDER BY id')).rows, fixedBefore.rows);
check((await db.query('SELECT count(*)::int AS n FROM custom_package_pricing')).rows[0].n,9);
await db.query("SELECT set_config('test.uid',$1,false),set_config('test.role','authenticated',false)",[buyer]);
const quote = async (class_id, subject_ids, group=null, version='bangla', extra={}) => (await db.query('SELECT quote_custom_package($1::jsonb) AS q',[JSON.stringify({version,class_id,group,subject_ids,...extra})])).rows[0].q;
const allSubjects = cid => fixture.subjects.filter(s=>s.class_id===cid).map(s=>s.id);
for (const [cid,math,version] of [[34,159,'bangla'],[32,131,'bangla'],[33,145,'bangla'],[41,243,'english'],[40,233,'english'],[39,223,'english']]) {
  const normals=allSubjects(cid).filter(id=>id!==math);
  check((await quote(cid,[normals[0]],null,version)).price,299);
  check((await quote(cid,[math],null,version)).price,490);
  for (const [n,price] of [[2,549],[3,749],[4,899],[5,999]]) check((await quote(cid,normals.slice(0,n),null,version)).price,price);
  check((await quote(cid,[math,normals[0]],null,version)).price,549);
}
for (const [cid,special,normal,version] of [[11,[104,105,106,107],71,'bangla'],[31,[212,213,214],209,'english']]) {
  const q=await quote(cid,special.slice(0,3),'Science',version);
  check([q.regular_total,q.price,q.savings,q.upgrade_difference],[1470,1099,371,400]);
  check((await quote(cid,[normal],'Science',version)).price,449);
  check((await quote(cid,[special[0]],'Science',version)).price,490);
  check((await quote(cid,special.slice(0,2),'Science',version)).price,849);
  const common=allSubjects(cid).filter(id=>!special.includes(id) && ![109,110,111,113,114,115,116,75,220,221,222,219].includes(id));
  for(const [n,price] of [[4,1249],[5,1349],[6,1399]]) check((await quote(cid,[...special,...common].slice(0,n),'Science',version)).price,price);
}
for (const [n,price] of [[1,490],[2,849],[3,1099],[4,1349],[5,1549],[6,1699],[7,1799]]) check((await quote(38,[197,198,199,200,203,204,205].slice(0,n),'Science')).price,price);
check((await quote(38,[201],'Science')).price,449);
check((await quote(38,[203],'Humanities')).price,490);
check((await quote(11,[109,71],'Business Studies')).price,849);
check((await quote(11,[113,71],'Humanities')).price,849);
check((await quote(11,[71,72],'Common Subjects')).price,849);
for(const selection of [
 {version:'bangla',class_id:34,subject_ids:[]},
 {version:'bangla',class_id:34,subject_ids:[159,159]},
 {version:'bangla',class_id:34,subject_ids:[243]},
 {version:'english',class_id:34,subject_ids:[159]},
 {version:'other',class_id:34,subject_ids:[159]},
 {version:'bangla',class_id:999,subject_ids:[159]},
 {version:'bangla',class_id:11,group:'Science',subject_ids:[109]},
 {version:'bangla',class_id:11,group:'Invalid',subject_ids:[104]},
 {version:'bangla',class_id:11,subject_ids:[104]},
 {version:'bangla',class_id:34,group:'Science',subject_ids:[159]},
]) await reject('SELECT quote_custom_package($1::jsonb)',[JSON.stringify(selection)]);
check((await quote(34,[159],null,'bangla',{price:1})).price,490);
await db.exec('UPDATE custom_package_subjects SET individual_price=100 WHERE subject_id=155');
check((await quote(34,[155,156])).price,399); // never exceed actual total
await db.exec('UPDATE pricing_packages SET price=300 WHERE id=3');
check((await quote(34,[159])).price,300); // dynamic All Subjects ceiling
await db.exec('UPDATE pricing_packages SET price=999 WHERE id=3; UPDATE custom_package_subjects SET individual_price=NULL WHERE subject_id=155');
await db.exec('UPDATE custom_package_subjects SET is_active=false WHERE subject_id=159');
await reject('SELECT quote_custom_package($1::jsonb)',[JSON.stringify({version:'bangla',class_id:34,subject_ids:[159]})]);
await db.exec('UPDATE custom_package_subjects SET is_active=true WHERE subject_id=159; UPDATE pricing_packages SET is_active=false WHERE id=3');
await reject('SELECT quote_custom_package($1::jsonb)',[JSON.stringify({version:'bangla',class_id:34,subject_ids:[159]})]);
await db.exec('UPDATE pricing_packages SET is_active=true WHERE id=3');
const order=await quote(11,[104,105],'Science');
const context={user_id:buyer,merchant_invoice_number:'reserve-test',amount:order.price,discount:0,selected_packages:[order],payer_reference:'01700000000',environment:'sandbox'};
const reservation=(await db.query('SELECT reserve_custom_payment($1::jsonb) AS id',[JSON.stringify(context)])).rows[0].id;
await reject('SELECT reserve_custom_payment($1::jsonb)',[JSON.stringify({...context,merchant_invoice_number:'second-tab'})]);
await db.query("UPDATE bkash_payments SET status='cancelled' WHERE id=$1",[reservation]);
checks++;
await db.exec("INSERT INTO coupon_counter(code) VALUES('TEST');");
const payment=(await db.query('INSERT INTO bkash_payments(user_id,payment_id,amount,discount,coupon_code,selected_packages) VALUES($1,$2,$3,50,\'TEST\',$4::jsonb) RETURNING id',[buyer,'payment-test',order.price-50,JSON.stringify([order])])).rows[0].id;
const receipt={paymentID:'payment-test',amount:String(order.price-50),currency:'BDT',transactionStatus:'Completed',trxID:'transaction-test'};
await reject('SELECT complete_custom_payment($1,$2::jsonb)',[payment,JSON.stringify({...receipt,amount:'1'})]);
const activated=(await db.query('SELECT complete_custom_payment($1,$2::jsonb) AS id',[payment,JSON.stringify(receipt)])).rows[0].id;
check((await db.query('SELECT complete_custom_payment($1,$2::jsonb) AS id',[payment,JSON.stringify(receipt)])).rows[0].id,activated);
check((await db.query("SELECT uses FROM coupon_counter WHERE code='TEST'")).rows[0].uses,1);
check((await db.query("SELECT extract(epoch from ends_at-starts_at)/86400 AS days FROM subscriptions WHERE id=$1",[activated])).rows[0].days,'365.0000000000000000');
check((await quote(11,[104],'Science')).owned_subject_ids,[104]);
await reject('SELECT reserve_custom_payment($1::jsonb)',[JSON.stringify(context)]);
for(const [cid,sid,expected] of [[11,104,true],[11,105,true],[11,106,false],[31,212,false],[34,159,false],[31,104,false]]) check((await db.query('SELECT can_read_question($1,$2) AS access',[cid,sid])).rows[0].access,expected);
await db.exec("ALTER TABLE questions ENABLE ROW LEVEL SECURITY; CREATE POLICY readable ON questions FOR SELECT TO authenticated USING(can_read_question(class_id,subject_id)); GRANT SELECT ON questions TO authenticated; GRANT INSERT ON saved_papers TO authenticated; GRANT USAGE ON SEQUENCE saved_papers_id_seq TO authenticated;");
await db.query('INSERT INTO questions VALUES(1,11,104,$1),(2,11,106,$1),(3,31,212,$1)',[other]);
await db.exec('SET ROLE authenticated');
check((await db.query('SELECT id FROM questions ORDER BY id')).rows,[{id:1}]);
await db.query('INSERT INTO saved_papers(teacher_id,question_ids) VALUES($1,ARRAY[1]::bigint[])',[buyer]); checks++;
await reject('INSERT INTO saved_papers(teacher_id,question_ids) VALUES($1,ARRAY[2]::bigint[])',[buyer]);
await reject("INSERT INTO subscriptions(teacher_id,plan,status) VALUES($1,'All Subjects','active')",[buyer]);
await reject('SELECT complete_custom_payment($1,$2::jsonb)',[payment,JSON.stringify(receipt)]);
await db.exec('RESET ROLE');
await db.query("SELECT set_config('test.uid',$1,false)",[other]);
check((await db.query('SELECT can_read_question(11,104) AS access')).rows[0].access,false);
await db.query("SELECT set_config('test.uid',$1,false)",[buyer]);
await db.query("UPDATE subscriptions SET ends_at=now()-interval '1 day' WHERE id=$1",[activated]);
check((await db.query('SELECT can_read_question(11,104) AS access')).rows[0].access,false);
for(const plan of ['ষষ্ঠ শ্রেণি - সকল বিষয়','ষষ্ঠ - দশম - সকল বিষয়','ষষ্ঠ - দ্বাদশ - সকল বিষয়','Class 8 (Eglish Version) - সকল বিষয়']) {
 await db.query("INSERT INTO subscriptions(teacher_id,plan,status,starts_at,ends_at) VALUES($1,$2,'active',now(),now()+interval '365 days')",[buyer,plan]);
}
for(const [cid,sid] of [[34,159],[32,131],[33,145],[11,104],[38,197],[39,223]]) check((await db.query('SELECT can_read_question($1,$2) AS access',[cid,sid])).rows[0].access,true);
check((await db.query('SELECT * FROM pricing_packages ORDER BY id')).rows,fixedBefore.rows);
console.log(`Custom Package Builder: ${checks} SQL checks passed (pricing, versions, groups, tampering, ownership, activation, expiry, RLS, coupons, fixed packages and bundles).`);
await db.close();
