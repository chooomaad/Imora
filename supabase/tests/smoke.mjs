// Imora DB smoke test: applies migrations + seed on PGlite with a minimal Supabase stub,
// then exercises the main RPCs as different users.
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { vector } from "@electric-sql/pglite-pgvector";
import { postgis } from "@electric-sql/pglite-postgis";
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const db = await PGlite.create({ extensions: { pg_trgm, unaccent, pgcrypto, vector, postgis } });

const stub = `
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
exception when duplicate_object then null; end $$;
grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, phone text,
  created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
  email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key, provider_id text, user_id uuid, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  unique (provider_id, provider));
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
`;
await db.exec(stub);

const migDir = path.join(root, "supabase/migrations");
for (const f of fs.readdirSync(migDir).sort()) {
  try {
    await db.exec(fs.readFileSync(path.join(migDir, f), "utf8"));
    console.log("OK  ", f);
  } catch (e) {
    console.error("FAIL", f, "\n", e.message, e.position ? `@${e.position}` : "", e.where ?? "");
    process.exit(1);
  }
}
try {
  await db.exec(fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  console.log("OK   seed.sql");
} catch (e) {
  console.error("FAIL seed.sql\n", e.message, e.where ?? "");
  process.exit(1);
}

// A check whose label contains "(should fail" must raise; every other check must succeed.
let failures = 0;
const q = async (label, sql, params = []) => {
  const mustFail = label.includes("(should fail");
  try {
    const r = await db.query(sql, params);
    const emptyExpected = label.includes("(should be 0 rows)") || label.includes("(should be empty");
    const ok = !mustFail && (!emptyExpected || r.rows.length === 0);
    if (!ok) failures++;
    console.log(`
${ok ? "PASS" : "FAIL"} ${label}
`, JSON.stringify(r.rows.slice(0, 6), null, 0).slice(0, 1200));
    return r.rows;
  } catch (e) {
    if (!mustFail) failures++;
    console.log(`
${mustFail ? "PASS" : "FAIL"} ${label}
  ERROR: ${e.message}`);
    return null;
  }
};
const as = async (uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  await db.exec(uid ? "set role authenticated" : "set role anon");
};

const CLIENT = "00000000-0000-4000-a000-000000000002";
const OWNER1 = "00000000-0000-4000-a000-000000000003";
const BARAKA = "00000000-0000-4000-a000-000000000005";
const ADMIN = "00000000-0000-4000-a000-000000000001";
const P1 = "00000000-0000-4000-f000-000000000001";

await q("counts", `select status, count(*) from properties group by 1`);
await q("flags", `select slug, has_360, has_3d from properties where has_360 or has_3d`);

await as(null);
await q("anon search villa TZ", `select title, price, lat, lng, cover_url is not null as cover, total_count from search_properties('{"listing_type":"sale","district":"Tevragh-Zeina","property_types":["villa"],"pool":true}'::jsonb, 5, 0)`);
await q("anon search by ids", `select title from search_properties('{}'::jsonb, 5, 0, null, array['${P1}']::uuid[])`);
await q("anon search q", `select title from search_properties('{"q":"palmeraie"}'::jsonb)`);
await q("anon bbox", `select count(*) from properties_in_bbox(-16.1, 18.0, -15.8, 18.2, '{}'::jsonb)`);
await q("anon count sale", `select count_properties('{"listing_type":"sale"}')`);
await q("anon reads exact location (should be 0 rows)", `select * from property_locations limit 1`);
await q("anon reads contacts (should be 0 rows)", `select * from profile_contacts limit 1`);
await q("anon reads agency phone (should fail: column privilege)", `select phone from agencies limit 1`);
await q("anon reads agency public columns", `select name, rating_avg from agencies limit 1`);
await q("anon property_location", `select * from property_location('${P1}')`);
await q("anon reveal (should fail)", `select * from reveal_contact('${P1}')`);
await q("anon tour read", `select t.title, count(s.*) from property_3d_tours t join property_360_scenes s on s.tour_id=t.id group by 1`);
await q("estimate", `select estimate_property_value('Nouakchott','Tevragh-Zeina','villa',300)`);

await as(CLIENT);
await q("client reveal", `select * from reveal_contact('${P1}')`);
await q("client whatsapp click", `select log_contact_event('${P1}', 'whatsapp_click')`);
await q("client favorite", `insert into favorites (user_id, property_id) values ('${CLIENT}', '${P1}') returning *`);
await q("client view", `select record_property_view('${P1}', 'sess1', 'test')`);
await q("client visit", `select id, status from request_visit('${P1}', current_date + 3, '10:00')`);
await q("client visit same slot again (should fail: slot_taken)", `select id from request_visit('${P1}', current_date + 3, '10:00')`);
await q("client bad slot (should fail: invalid_slot)", `select id from request_visit('${P1}', current_date + 4, '09:00')`);
await q("taken slots", `select * from taken_visit_slots('${P1}', current_date, current_date + 10)`);
await q("client message", `select id from start_conversation('${P1}', 'Bonjour, le bien est-il disponible ?')`);
await q("client tries to escalate role (should fail)", `update profiles set role='admin' where id='${CLIENT}'`);
await q("client tries to insert property (should fail)", `insert into properties (slug,title,listing_type,property_type,price,owner_id,city) values ('x','x','sale','villa',1,'${CLIENT}','Nouakchott')`);
await q("client exact location (should be empty: not manager)", `select * from property_location_exact('${P1}')`);
await q("client recommendations", `select * from recommend_properties(5)`);
await q("client declares transaction", `select id, status, confirmed_by_buyer from declare_transaction('${P1}', 'sale', 8300000)`);
await q("client sees leads (should be 0 rows)", `select id from property_leads`);

await as(BARAKA);
await q("agency leads", `select source, status, interactions_count from property_leads`);
await q("agency exact location", `select * from property_location_exact('${P1}')`);
await q("agency stats", `select listing_stats('00000000-0000-4000-b000-000000000001')`);
await q("agency confirms transaction", `select status, commission_rate, commission_amount from confirm_transaction((select id from transactions limit 1), true)`);
await q("agency notifications", `select type, title from notifications order by created_at`);
await q("agency tries to verify own property (ignored)", `update properties set is_verified=false, price=price where id='${P1}' returning is_verified`);
await q("agency creates draft", `insert into properties (slug,title,listing_type,property_type,price,owner_id,city,status,agency_id) values ('new-x','Nouvelle villa','sale','villa',5000000,'${BARAKA}','Nouakchott','published','00000000-0000-4000-b000-000000000001') returning status, reference`);

await as(ADMIN);
await q("admin kpis", `select admin_kpis(30)`);
await q("commission payments", `select amount, status from commission_payments`);
await q("audit", `select action, entity_type from audit_logs order by id desc limit 5`);

await as(OWNER1);
await q("owner choose role again (should fail)", `select role from choose_role('client')`);
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
