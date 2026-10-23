-- =============================================================================
-- Imora — DEMO seed data (development only)
-- Every row created here has is_demo = true and is shown with a "DÉMO" badge.
-- These are NOT real listings. Do not run this file on production.
--
-- Demo accounts (password: ImoraDemo2026!)
--   admin@demo.imora.mr      ADMIN
--   client@demo.imora.mr     CLIENT
--   owner1@demo.imora.mr     PROPRIETAIRE
--   owner2@demo.imora.mr     PROPRIETAIRE
--   baraka@demo.imora.mr     AGENCY_ADMIN (Al-Baraka Immobilier)
--   agent@demo.imora.mr      AGENT (Al-Baraka Immobilier)
--   atlantique@demo.imora.mr AGENCY_ADMIN (Atlantique Habitat)
--   promoteur@demo.imora.mr  DEVELOPER (Sahara Développement)
--
-- Media: photos from Unsplash, 360° panoramas from Poly Haven (CC0).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@demo.imora.mr', 'Équipe Imora', '+22236000001'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'client@demo.imora.mr', 'Mariem Client (démo)', '+22236000002'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'owner1@demo.imora.mr', 'Sidi Propriétaire (démo)', '+22236000003'),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'owner2@demo.imora.mr', 'Aïcha Propriétaire (démo)', '+22236000004'),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'baraka@demo.imora.mr', 'Mohamed Directeur (démo)', '+22236000005'),
      ('00000000-0000-4000-a000-000000000006'::uuid, 'agent@demo.imora.mr', 'Ahmed Agent (démo)', '+22236000006'),
      ('00000000-0000-4000-a000-000000000007'::uuid, 'atlantique@demo.imora.mr', 'Khadija Directrice (démo)', '+22236000007'),
      ('00000000-0000-4000-a000-000000000008'::uuid, 'promoteur@demo.imora.mr', 'Oumar Promoteur (démo)', '+22236000008')
    ) as t(id, email, full_name, phone)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('ImoraDemo2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.full_name, 'phone', u.phone),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id::text, u.id,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

update public.profiles set is_demo = true, role_selected = true where id::text like '00000000-0000-4000-a000-%';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set role = 'proprietaire', is_verified = true where id in ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004');
update public.profiles set role = 'agency_admin' where id in ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000007');
update public.profiles set role = 'agent' where id = '00000000-0000-4000-a000-000000000006';
update public.profiles set role = 'developer' where id = '00000000-0000-4000-a000-000000000008';
update public.profile_contacts set whatsapp = phone where profile_id::text like '00000000-0000-4000-a000-%';

insert into public.owners (profile_id, kyc_status, verified_at) values
  ('00000000-0000-4000-a000-000000000003', 'approved', now()),
  ('00000000-0000-4000-a000-000000000004', 'approved', now())
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Agencies, agents, developer
-- ---------------------------------------------------------------------------
insert into public.agencies (id, slug, name, name_ar, description, city, address, phone, whatsapp, email, is_verified, rating_avg, rating_count, avg_response_minutes, created_by, is_demo, logo_url) values
  ('00000000-0000-4000-b000-000000000001', 'al-baraka-immobilier', 'Al-Baraka Immobilier', 'البركة للعقار',
   'Agence de démonstration spécialisée dans les villas et résidences haut de gamme de Tevragh-Zeina et Las Palmas.',
   'Nouakchott', 'Tevragh-Zeina, Nouakchott', '+22236000105', '+22236000105', 'contact@demo.imora.mr', true, 4.9, 48, 15,
   '00000000-0000-4000-a000-000000000005', true,
   'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=256&h=256&fit=crop'),
  ('00000000-0000-4000-b000-000000000002', 'atlantique-habitat', 'Atlantique Habitat', 'الأطلسي للسكن',
   'Agence de démonstration — locations et appartements avec vue mer à Nouadhibou.',
   'Nouadhibou', 'Baie du Lévrier, Nouadhibou', '+22236000107', '+22236000107', 'nouadhibou@demo.imora.mr', true, 4.6, 21, 40,
   '00000000-0000-4000-a000-000000000007', true,
   'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=256&h=256&fit=crop')
on conflict (id) do nothing;

insert into public.agents (id, agency_id, profile_id, title, is_agency_admin) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000005', 'Directeur', true),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000006', 'Conseiller immobilier', false),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000007', 'Directrice', true)
on conflict do nothing;

insert into public.subscriptions (agency_id, plan_code) values
  ('00000000-0000-4000-b000-000000000001', 'agency_pro'),
  ('00000000-0000-4000-b000-000000000002', 'agency_basic');

insert into public.developers (id, profile_id, slug, company_name, description, phone, is_verified, is_demo) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-a000-000000000008', 'sahara-developpement', 'Sahara Développement',
   'Promoteur de démonstration — résidences neuves à Nouakchott.', '+22236000108', true, true)
on conflict do nothing;

insert into public.projects (id, developer_id, slug, name, name_ar, description, city, district, location, cover_url, gallery, status, delivery_date, progress_pct, price_from, is_published, is_demo) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000001', 'residence-les-dunes', 'Résidence Les Dunes', 'إقامة الكثبان',
   'Projet de démonstration : 32 appartements du T2 au T4, piscine commune, gardiennage 24/7 et groupe électrogène.',
   'Nouakchott', 'Tevragh-Zeina', extensions.st_setsrid(extensions.st_makepoint(-15.9712, 18.1121), 4326)::extensions.geography,
   'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600',
   array['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600'],
   'under_construction', '2027-09-30', 45, 3800000, true, true),
  ('00000000-0000-4000-e000-000000000002', '00000000-0000-4000-d000-000000000001', 'les-jardins-de-teyarett', 'Les Jardins de Teyarett', 'حدائق تيارت',
   'Projet de démonstration : 18 villas jumelées avec jardin privatif.',
   'Nouakchott', 'Teyarett', extensions.st_setsrid(extensions.st_makepoint(-15.9512, 18.1342), 4326)::extensions.geography,
   'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1600', '{}',
   'planned', '2028-06-30', 10, 6200000, true, true)
on conflict do nothing;

insert into public.project_units (project_id, label, unit_type, floor, bedrooms, bathrooms, area_m2, price, status)
select '00000000-0000-4000-e000-000000000001', 'Lot ' || i, 'apartment', (i - 1) / 8, 2 + (i % 3), 1 + (i % 2), 85 + (i % 3) * 30, 3800000 + (i % 3) * 1400000,
       (case when i % 5 = 0 then 'sold' when i % 7 = 0 then 'reserved' else 'available' end)::public.unit_status
from generate_series(1, 32) i;
insert into public.project_units (project_id, label, unit_type, bedrooms, bathrooms, area_m2, price, status)
select '00000000-0000-4000-e000-000000000002', 'Villa ' || i, 'villa', 4, 3, 210, 6200000, 'available'
from generate_series(1, 18) i;

-- ---------------------------------------------------------------------------
-- Helper (temporary) to create a property with location, cover and gallery
-- ---------------------------------------------------------------------------
create function pg_temp.add_property(
  p_id uuid, p_slug text, p_title text, p_title_ar text, p_desc text,
  p_listing public.listing_type, p_type public.property_type, p_price bigint, p_period public.price_period,
  p_owner uuid, p_agency uuid, p_agent uuid,
  p_city text, p_district text, p_lng double precision, p_lat double precision,
  p_beds int, p_baths int, p_area numeric, p_land numeric, p_parking int, p_pool boolean, p_garden boolean,
  p_verified boolean, p_yield numeric, p_images text[]
) returns void language plpgsql as $$
declare i int;
begin
  insert into public.properties (
    id, slug, title, title_ar, description, listing_type, property_type, status, price, price_period,
    owner_id, agency_id, agent_id, city, district, bedrooms, bathrooms, area_m2, land_area_m2,
    parking_spaces, has_pool, has_garden, is_verified, documents_verified, estimated_yield, is_demo,
    published_at, price_negotiable, notary_fees_estimate
  ) values (
    p_id, p_slug, p_title, p_title_ar, p_desc, p_listing, p_type, 'published', p_price, p_period,
    p_owner, p_agency, p_agent, p_city, p_district, p_beds, p_baths, p_area, p_land,
    p_parking, p_pool, p_garden, p_verified, p_verified, p_yield, true,
    now() - (abs(hashtext(p_slug)) % 40) * interval '1 day',
    p_period = 'total', case when p_period = 'total' then round(p_price * 0.05, -4) end
  ) on conflict (id) do nothing;

  insert into public.property_locations (property_id, geog, is_approximate)
  values (p_id, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography, p_agency is null)
  on conflict do nothing;

  for i in 1 .. coalesce(array_length(p_images, 1), 0) loop
    insert into public.property_media (property_id, kind, url, position, is_cover, width, height)
    values (p_id, 'image', 'https://images.unsplash.com/photo-' || p_images[i] || '?w=1600&q=80&auto=format&fit=crop', i - 1, i = 1, 1600, 1067);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Hand-crafted listings (match the design references)
-- ---------------------------------------------------------------------------
select pg_temp.add_property('00000000-0000-4000-f000-000000000001', 'villa-moderne-palmeraie-demo', 'Villa Moderne Palmeraie', 'فيلا النخيل العصرية',
  'Villa contemporaine de démonstration : salon de réception en marbre ouvert sur un patio d''eau intérieur, piscine carrelée et quatre suites climatisées.',
  'sale', 'villa', 8500000, 'total', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000002',
  'Nouakchott', 'Tevragh-Zeina', -15.9779, 18.1031, 4, 3, 320, 500, 2, true, true, true, 10.0,
  array['1613490493576-7fde63acd811', '1600607687939-ce8a6c25118c', '1600566753190-17f0baa2a6c3', '1600210492486-724fe5c67fb0', '1584622650111-993a426fbf0a']);

select pg_temp.add_property('00000000-0000-4000-f000-000000000002', 'villa-contemporaine-sahara-demo', 'Villa Contemporaine Sahara', 'فيلا الصحراء المعاصرة',
  'Située dans le secteur le plus prisé de Tevragh-Zeina, cette villa architecturale réinterprète les principes traditionnels de l''habitat désertique mauritanien avec une élégance contemporaine rare.' || chr(10) || chr(10) ||
  'Ses doubles vitrages isolants thermo-acoustiques et son système d''aération croisée neutralisent la chaleur côtière et les poussières éoliennes. Les volumes s''articulent autour d''un magnifique patio lumineux ouvert sur le bassin de nage et un salon de réception noble aux boiseries travaillées.',
  'sale', 'villa', 8500000, 'total', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000002',
  'Nouakchott', 'Tevragh-Zeina', -15.9711, 18.1102, 4, 3, 320, 500, 2, true, false, true, null,
  array['1600596542815-ffad4c1539a9', '1600585154340-be6161a56a0c', '1600607687644-c7171b42498f', '1600566753086-00f18fb6b3ea', '1552321554-5fefe8c9ef14']);
update public.properties set reference = 'TZ-882', has_generator = true, water_tank_liters = 10000, furnished = false where id = '00000000-0000-4000-f000-000000000002';

select pg_temp.add_property('00000000-0000-4000-f000-000000000003', 'appartement-vue-baie-demo', 'Appartement Vue Baie', 'شقة بإطلالة على الخليج',
  'Appartement de démonstration lumineux face à la baie du Lévrier, deux chambres, grand séjour et balcon filant avec vue mer.',
  'rent', 'apartment', 35000, 'month', '00000000-0000-4000-a000-000000000007', '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-000000000003',
  'Nouadhibou', null, -17.0386, 20.9432, 2, 2, 115, null, 1, false, false, true, null,
  array['1545324418-cc1a3fa10c00', '1502672260266-1c1ef2d93688', '1522708323590-d24dbb6b0267', '1493809842364-78817add7ffb']);
update public.properties set available_from = current_date, furnished = true where id = '00000000-0000-4000-f000-000000000003';
insert into public.property_features (property_id, feature_key, value) values
  ('00000000-0000-4000-f000-000000000003', 'sea_view', 'true'),
  ('00000000-0000-4000-f000-000000000003', 'air_conditioning', 'true');

select pg_temp.add_property('00000000-0000-4000-f000-000000000004', 'terrain-teyarett-demo', 'Terrain viabilisé Teyarett', 'أرض مجهزة في تيارت',
  'Terrain de démonstration de 600 m², titre foncier, raccordé eau et électricité, rue goudronnée.',
  'sale', 'land', 650000, 'total', '00000000-0000-4000-a000-000000000003', null, null,
  'Nouakchott', 'Teyarett', -15.9592, 18.1218, null, null, null, 600, 0, false, false, false, null,
  array['1500382017468-9049fed747ef']);

select pg_temp.add_property('00000000-0000-4000-f000-000000000005', 'villa-las-palmas-demo', 'Villa Las Palmas', 'فيلا لاس بالماس',
  'Villa de démonstration sur deux niveaux, cinq chambres, jardin arboré et piscine, à deux pas de la plage.',
  'sale', 'villa', 12000000, 'total', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001',
  'Nouakchott', 'Las Palmas', -15.9905, 18.1083, 5, 4, 410, 650, 3, true, true, true, null,
  array['1613977257363-707ba9348227', '1600047509807-ba8f99d2cdde', '1615874959474-d609969a20ed', '1556912173-3bb406ef7e77']);

select pg_temp.add_property('00000000-0000-4000-f000-000000000006', 'immeuble-r3-ksar-demo', 'Immeuble R+3 Ksar', 'عمارة من أربعة طوابق في لكصر',
  'Immeuble de rapport de démonstration : 8 appartements et 2 commerces en rez-de-chaussée, entièrement loué.',
  'investment', 'building', 18500000, 'total', '00000000-0000-4000-a000-000000000004', null, null,
  'Nouakchott', 'Ksar', -15.9515, 18.0905, null, 10, 780, 300, 4, false, false, true, 8.7,
  array['1486406146926-c627a92ad1ab', '1545324418-cc1a3fa10c00']);
update public.properties set occupancy_rate = 100 where id = '00000000-0000-4000-f000-000000000006';

select pg_temp.add_property('00000000-0000-4000-f000-000000000007', 'maison-familiale-ksar-demo', 'Maison familiale Ksar', 'منزل عائلي في لكصر',
  'Maison de démonstration avec cour intérieure, quatre chambres, proche des écoles et du marché.',
  'sale', 'house', 4200000, 'total', '00000000-0000-4000-a000-000000000003', null, null,
  'Nouakchott', 'Ksar', -15.9564, 18.0968, 4, 2, 210, 300, 1, false, true, false, null,
  array['1570129477492-45c003edd2be', '1580587771525-78b9dba3b914']);

select pg_temp.add_property('00000000-0000-4000-f000-000000000008', 'bureaux-centre-affaires-demo', 'Plateau de bureaux — Centre d''Affaires', 'مكاتب في مركز الأعمال',
  'Plateau de bureaux de démonstration de 180 m², climatisé, fibre optique, parking sécurisé.',
  'rent', 'office', 120000, 'month', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001',
  'Nouakchott', 'Tevragh-Zeina', -15.9688, 18.0986, null, 2, 180, null, 4, false, false, true, null,
  array['1497366216548-37526070297c', '1486406146926-c627a92ad1ab']);

select pg_temp.add_property('00000000-0000-4000-f000-000000000009', 'local-commercial-capitale-demo', 'Local commercial Capitale', 'محل تجاري في العاصمة',
  'Local commercial de démonstration en angle de rue, forte fréquentation piétonne.',
  'rent', 'retail', 45000, 'month', '00000000-0000-4000-a000-000000000004', null, null,
  'Nouakchott', 'Sebkha', -15.9852, 18.0712, null, 1, 70, null, 0, false, false, false, null,
  array['1441986300917-64674bd600d8']);

select pg_temp.add_property('00000000-0000-4000-f000-000000000010', 'residence-meublee-tevragh-zeina-demo', 'Résidence meublée Tevragh-Zeina', 'إقامة مفروشة في تفرغ زينة',
  'Résidence de démonstration de 6 appartements meublés loués à des expatriés et cadres du secteur énergétique.',
  'investment', 'building', 22000000, 'total', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-000000000001',
  'Nouakchott', 'Tevragh-Zeina', -15.9741, 18.1069, 12, 8, 540, 400, 6, true, false, true, 9.4,
  array['1600585154340-be6161a56a0c', '1502672260266-1c1ef2d93688']);
update public.properties set occupancy_rate = 89, furnished = true where id = '00000000-0000-4000-f000-000000000010';

insert into public.property_nearby (property_id, category, name, travel_minutes, travel_mode) values
  ('00000000-0000-4000-f000-000000000002', 'school', 'École Française', 3, 'car'),
  ('00000000-0000-4000-f000-000000000002', 'embassy', 'Ambassade de France', 4, 'car'),
  ('00000000-0000-4000-f000-000000000002', 'shop', 'Bana Blanc', 5, 'walk'),
  ('00000000-0000-4000-f000-000000000002', 'mosque', 'Mosquée Ibn Abbas', 6, 'car'),
  ('00000000-0000-4000-f000-000000000001', 'school', 'École Française', 5, 'car'),
  ('00000000-0000-4000-f000-000000000001', 'mosque', 'Mosquée Ibn Abbas', 4, 'car'),
  ('00000000-0000-4000-f000-000000000001', 'shop', 'Bana Blanc', 7, 'walk'),
  ('00000000-0000-4000-f000-000000000005', 'beach', 'Plage de Nouakchott', 4, 'car');

insert into public.property_features (property_id, feature_key, value) values
  ('00000000-0000-4000-f000-000000000002', 'air_conditioning', 'true'),
  ('00000000-0000-4000-f000-000000000002', 'generator_kva', '25'),
  ('00000000-0000-4000-f000-000000000002', 'double_glazing', 'true'),
  ('00000000-0000-4000-f000-000000000001', 'air_conditioning', 'true'),
  ('00000000-0000-4000-f000-000000000001', 'marble_floors', 'true');

create function pg_temp.placename_ar(p text) returns text language sql immutable as $$
  select coalesce('{"Nouakchott":"نواكشوط","Nouadhibou":"نواذيبو","Rosso":"روصو","Atar":"أطار","Kiffa":"كيفة","Kaédi":"كيهيدي","Zouerate":"ازويرات","Tevragh-Zeina":"تفرغ زينة","Las Palmas":"لاس بالماس","Ksar":"لكصر","Teyarett":"تيارت","Dar Naim":"دار النعيم","Arafat":"عرفات","Sebkha":"السبخة","El Mina":"الميناء"}'::jsonb ->> p, p)
$$;

-- ---------------------------------------------------------------------------
-- Generated listings across Mauritania (deterministic, all DEMO)
-- ---------------------------------------------------------------------------
do $$
declare
  places jsonb := '[
    ["Nouakchott","Tevragh-Zeina",-15.9750,18.1050],["Nouakchott","Las Palmas",-15.9890,18.1110],
    ["Nouakchott","Ksar",-15.9530,18.0940],["Nouakchott","Teyarett",-15.9520,18.1300],
    ["Nouakchott","Dar Naim",-15.9250,18.1180],["Nouakchott","Arafat",-15.9520,18.0530],
    ["Nouakchott","Sebkha",-15.9900,18.0700],["Nouakchott","El Mina",-15.9800,18.0450],
    ["Nouadhibou",null,-17.0400,20.9400],["Rosso",null,-15.8050,16.5130],["Atar",null,-13.0500,20.5170],
    ["Kiffa",null,-11.4040,16.6200],["Kaédi",null,-13.5040,16.1520],["Zouerate",null,-12.4700,22.7350]]';
  types text[] := array['villa','apartment','house','apartment','villa','land','house','office','retail','apartment'];
  villa_img text[] := array['1600596542815-ffad4c1539a9','1613490493576-7fde63acd811','1512917774080-9991f1c4c750','1613977257363-707ba9348227','1605276374104-dee2a0ed3cd6','1600047509807-ba8f99d2cdde'];
  house_img text[] := array['1580587771525-78b9dba3b914','1564013799919-ab600027ffc6','1568605114967-8130f3a36994','1570129477492-45c003edd2be'];
  apt_img text[] := array['1545324418-cc1a3fa10c00','1502672260266-1c1ef2d93688','1560448204-e02f11c3d0e2','1522708323590-d24dbb6b0267','1493809842364-78817add7ffb'];
  interior_img text[] := array['1600607687939-ce8a6c25118c','1600566753190-17f0baa2a6c3','1600210492486-724fe5c67fb0','1556912173-3bb406ef7e77','1584622650111-993a426fbf0a','1615874959474-d609969a20ed'];
  owners uuid[] := array['00000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005']::uuid[];
  i int; pl jsonb; t text; lt text; pr bigint; per text; beds int; area int; imgs text[];
  v_owner uuid; v_agency uuid; v_agent uuid; v_title text; v_title_ar text; place_idx int;
  type_fr jsonb := '{"villa":"Villa","apartment":"Appartement","house":"Maison","land":"Terrain","office":"Bureaux","retail":"Local commercial"}';
  type_ar jsonb := '{"villa":"فيلا","apartment":"شقة","house":"منزل","land":"أرض","office":"مكاتب","retail":"محل تجاري"}';
begin
  for i in 1 .. 50 loop
    -- Nouakchott gets ~70% of listings
    place_idx := case when i % 10 < 7 then (i * 5) % 8 else 8 + (i % 6) end;
    pl := places -> place_idx;
    t := types[1 + (i * 7) % array_length(types, 1)];
    lt := case when t = 'land' then 'sale' when i % 3 = 0 then 'rent' else 'sale' end;
    beds := case when t in ('land', 'office', 'retail') then null when t = 'villa' then 4 + i % 3 when t = 'house' then 3 + i % 3 else 1 + i % 4 end;
    area := case t when 'villa' then 260 + (i * 37) % 260 when 'house' then 150 + (i * 23) % 150 when 'apartment' then 70 + (i * 13) % 110
                   when 'land' then 300 + (i * 50) % 900 when 'office' then 80 + (i * 17) % 200 else 40 + (i * 11) % 80 end;
    -- Price per m² depends on district and listing type (MRU)
    if lt = 'rent' then
      per := 'month';
      pr := round(area * (case when place_idx in (0, 1) then 260 when place_idx < 8 then 150 else 110 end) * (0.85 + (i % 7) * 0.05), -3);
    else
      per := 'total';
      pr := round(area * (case when t = 'land' then 0.12 when true then 1 end)
              * (case when place_idx in (0, 1) then 26000 when place_idx in (2, 3) then 19000 when place_idx < 8 then 13000 else 11000 end)
              * (0.85 + (i % 7) * 0.05), -4);
    end if;
    imgs := case
      when t = 'villa' then array[villa_img[1 + i % 6], interior_img[1 + i % 6], interior_img[1 + (i + 2) % 6]]
      when t = 'house' then array[house_img[1 + i % 4], interior_img[1 + (i + 1) % 6]]
      when t = 'apartment' then array[apt_img[1 + i % 5], interior_img[1 + (i + 3) % 6]]
      when t = 'land' then array['1500382017468-9049fed747ef']
      when t = 'office' then array['1497366216548-37526070297c', '1486406146926-c627a92ad1ab']
      else array['1441986300917-64674bd600d8'] end;
    v_owner := owners[1 + i % 3];
    v_agency := case when v_owner = '00000000-0000-4000-a000-000000000005' then '00000000-0000-4000-b000-000000000001'::uuid end;
    v_agent := case when v_agency is not null then '00000000-0000-4000-c000-000000000002'::uuid end;
    v_title := (type_fr ->> t) || case when beds is not null and t <> 'villa' then ' ' || beds || ' ch.' else '' end
               || ' — ' || coalesce(pl ->> 1, pl ->> 0);
    v_title_ar := (type_ar ->> t) || ' — ' || pg_temp.placename_ar(coalesce(pl ->> 1, pl ->> 0));

    perform pg_temp.add_property(
      ('00000000-0000-4000-f100-' || lpad(i::text, 12, '0'))::uuid,
      'demo-' || t || '-' || lower(regexp_replace(extensions.unaccent(coalesce(pl ->> 1, pl ->> 0)), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || i,
      v_title, v_title_ar,
      'Annonce de démonstration générée pour le développement. ' || (type_fr ->> t) || ' de ' || area || ' m² à ' || coalesce(pl ->> 1, pl ->> 0) || '.',
      lt::public.listing_type, t::public.property_type, pr, per::public.price_period,
      v_owner, v_agency, v_agent, pl ->> 0, pl ->> 1,
      (pl ->> 2)::float8 + ((i * 7919) % 100 - 50) / 4000.0, (pl ->> 3)::float8 + ((i * 6271) % 100 - 50) / 4000.0,
      beds, case when beds is null then null else greatest(1, beds - 1) end, area,
      case when t in ('villa', 'house', 'land') then area * 1.5 end,
      case when t in ('villa', 'office') then 2 when t = 'house' then 1 else i % 2 end,
      t = 'villa' and i % 2 = 0, t in ('villa', 'house') and i % 3 = 0,
      i % 4 <> 0,
      case when lt = 'sale' and t in ('apartment', 'building') and i % 2 = 0 then 6.5 + (i % 5) * 0.8 end,
      imgs
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 360° tour + dynamic floor plan for "Villa Moderne Palmeraie"
-- ---------------------------------------------------------------------------
create function pg_temp.pano(p_name text) returns text language sql immutable as $$
  select 'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/' || p_name || '.jpg'
$$;

do $$
declare
  v_prop uuid := '00000000-0000-4000-f000-000000000001';
  v_tour uuid := '00000000-0000-4000-9000-000000000001';
  fp_rdc uuid := '00000000-0000-4000-9100-000000000001';
  fp_r1 uuid := '00000000-0000-4000-9100-000000000002';
  fp_roof uuid := '00000000-0000-4000-9100-000000000003';
  r_garage uuid := gen_random_uuid(); r_salon uuid := gen_random_uuid(); r_cuisine uuid := gen_random_uuid();
  r_chambre uuid := gen_random_uuid(); r_patio uuid := gen_random_uuid(); r_sam uuid := gen_random_uuid();
  r_suite uuid := gen_random_uuid(); r_suite2 uuid := gen_random_uuid(); r_suite3 uuid := gen_random_uuid();
  r_suite4 uuid := gen_random_uuid(); r_sdb uuid := gen_random_uuid(); r_terrasse uuid := gen_random_uuid();
  s_salon uuid := '00000000-0000-4000-9200-000000000001'; s_cuisine uuid := gen_random_uuid(); s_sam uuid := gen_random_uuid();
  s_chambre uuid := gen_random_uuid(); s_garage uuid := gen_random_uuid(); s_patio uuid := gen_random_uuid();
  s_suite uuid := gen_random_uuid(); s_sdb uuid := gen_random_uuid(); s_terrasse uuid := gen_random_uuid();
begin
  insert into public.property_3d_tours (id, property_id, title, status, source, is_verified)
  values (v_tour, v_prop, 'Visite 360 Plein Écran', 'draft', 'manual_360', true);

  insert into public.property_floor_plans (id, tour_id, level, name, name_ar, scale_label, width_m, depth_m) values
    (fp_rdc, v_tour, 0, 'Rez-de-chaussée (RDC)', 'الطابق الأرضي', '1:100', 20.6, 12.4),
    (fp_r1, v_tour, 1, '1er Étage (4 Suites)', 'الطابق الأول (4 أجنحة)', '1:100', 20.6, 12.4),
    (fp_roof, v_tour, 2, 'Terrasse Rooftop', 'السطح', '1:100', 20.6, 12.4);

  insert into public.property_rooms (id, tour_id, floor_plan_id, name, name_ar, room_type, area_m2, length_m, width_m, ceiling_height_m, material, plan_rect, position) values
    (r_garage, v_tour, fp_rdc, 'Garage', 'مرآب', 'garage', 37, 6.2, 6.0, 3.0, 'Béton ciré', array[0, 0, 0.3, 0.5], 0),
    (r_salon, v_tour, fp_rdc, 'Salon Principal', 'الصالون الرئيسي', 'living', 42, 6.8, 6.2, 3.2, 'Marbre', array[0.3, 0, 0.35, 0.55], 1),
    (r_cuisine, v_tour, fp_rdc, 'Cuisine', 'مطبخ', 'kitchen', 24, 6.0, 4.0, 3.0, 'Grès cérame', array[0.65, 0, 0.35, 0.5], 2),
    (r_chambre, v_tour, fp_rdc, 'Chambre', 'غرفة نوم', 'bedroom', 20, 5.0, 4.0, 3.0, 'Parquet', array[0, 0.5, 0.3, 0.5], 3),
    (r_patio, v_tour, fp_rdc, 'Patio d''eau intérieur', 'فناء مائي داخلي', 'patio', 30, 6.0, 5.0, null, 'Zellige', array[0.3, 0.55, 0.35, 0.45], 4),
    (r_sam, v_tour, fp_rdc, 'Salle à manger', 'غرفة الطعام', 'dining', 22, 5.5, 4.0, 3.2, 'Marbre', array[0.65, 0.5, 0.35, 0.5], 5),
    (r_suite, v_tour, fp_r1, 'Suite parentale', 'الجناح الرئيسي', 'bedroom', 34, 6.8, 5.0, 3.0, 'Parquet', array[0, 0, 0.4, 0.5], 0),
    (r_suite2, v_tour, fp_r1, 'Suite 2', 'جناح 2', 'bedroom', 22, 5.0, 4.4, 3.0, 'Parquet', array[0.4, 0, 0.3, 0.5], 1),
    (r_suite3, v_tour, fp_r1, 'Suite 3', 'جناح 3', 'bedroom', 22, 5.0, 4.4, 3.0, 'Parquet', array[0.7, 0, 0.3, 0.5], 2),
    (r_suite4, v_tour, fp_r1, 'Suite 4', 'جناح 4', 'bedroom', 20, 5.0, 4.0, 3.0, 'Parquet', array[0, 0.5, 0.4, 0.5], 3),
    (r_sdb, v_tour, fp_r1, 'Salle de bain', 'حمام', 'bathroom', 12, 4.0, 3.0, 2.8, 'Marbre', array[0.4, 0.5, 0.3, 0.5], 4),
    (r_terrasse, v_tour, fp_roof, 'Terrasse Rooftop', 'السطح', 'terrace', 85, 12.0, 7.1, null, 'Dallage', array[0.1, 0.1, 0.8, 0.8], 0);

  insert into public.property_360_scenes (id, tour_id, room_id, name, panorama_url, initial_yaw, position) values
    (s_salon, v_tour, r_salon, 'Salon Principal', pg_temp.pano('lebombo'), 0, 0),
    (s_patio, v_tour, r_patio, 'Patio / Piscine', pg_temp.pano('courtyard'), 0, 1),
    (s_cuisine, v_tour, r_cuisine, 'Cuisine', pg_temp.pano('cayley_interior'), 0, 2),
    (s_sam, v_tour, r_sam, 'Salle à manger', pg_temp.pano('st_fagans_interior'), 0, 3),
    (s_chambre, v_tour, r_chambre, 'Chambre', pg_temp.pano('hotel_room'), 0, 4),
    (s_garage, v_tour, r_garage, 'Garage', pg_temp.pano('garage'), 0, 5),
    (s_suite, v_tour, r_suite, 'Suite parentale', pg_temp.pano('kiara_interior'), 0, 6),
    (s_sdb, v_tour, r_sdb, 'Salle de bain', pg_temp.pano('bathroom'), 0, 7),
    (s_terrasse, v_tour, r_terrasse, 'Terrasse Rooftop', pg_temp.pano('veranda'), 0, 8);

  insert into public.property_hotspots (scene_id, kind, target_scene_id, yaw, pitch, label, label_ar, icon) values
    (s_salon, 'navigation', s_patio, -20, -12, 'Patio / Piscine', 'الفناء / المسبح', 'pool'),
    (s_salon, 'navigation', s_cuisine, 35, -5, 'Cuisine', 'المطبخ', 'kitchen'),
    (s_salon, 'navigation', s_sam, 80, -6, 'Salle à manger', 'غرفة الطعام', 'dining'),
    (s_salon, 'navigation', s_suite, 150, 8, 'Étage — Suites', 'الطابق — الأجنحة', 'stairs'),
    (s_salon, 'navigation', s_garage, -110, -8, 'Garage', 'المرآب', 'garage'),
    (s_patio, 'navigation', s_salon, 180, -8, 'Salon Principal', 'الصالون', 'living'),
    (s_patio, 'navigation', s_chambre, -70, -6, 'Chambre', 'غرفة النوم', 'bedroom'),
    (s_cuisine, 'navigation', s_salon, 180, -6, 'Salon Principal', 'الصالون', 'living'),
    (s_cuisine, 'navigation', s_sam, 90, -6, 'Salle à manger', 'غرفة الطعام', 'dining'),
    (s_sam, 'navigation', s_salon, -90, -6, 'Salon Principal', 'الصالون', 'living'),
    (s_sam, 'navigation', s_cuisine, 0, -6, 'Cuisine', 'المطبخ', 'kitchen'),
    (s_chambre, 'navigation', s_patio, 90, -6, 'Patio', 'الفناء', 'pool'),
    (s_garage, 'navigation', s_salon, 60, -6, 'Salon Principal', 'الصالون', 'living'),
    (s_suite, 'navigation', s_sdb, 70, -6, 'Salle de bain', 'الحمام', 'bath'),
    (s_suite, 'navigation', s_terrasse, -60, 12, 'Terrasse Rooftop', 'السطح', 'stairs'),
    (s_suite, 'navigation', s_salon, 180, -15, 'RDC — Salon', 'الطابق الأرضي', 'stairs'),
    (s_sdb, 'navigation', s_suite, 180, -6, 'Suite parentale', 'الجناح الرئيسي', 'bedroom'),
    (s_terrasse, 'navigation', s_suite, 180, -20, 'Suites', 'الأجنحة', 'stairs'),
    (s_salon, 'info', null, 120, -2, 'Plafond 3,2 m — corniches en plâtre sculpté', 'سقف 3.2 م', 'info'),
    (s_patio, 'info', null, 30, -18, 'Bassin carrelé 8 × 3 m', 'مسبح 8 × 3 م', 'info');

  update public.property_3d_tours set start_scene_id = s_salon, status = 'published' where id = v_tour;
end $$;

-- A smaller published tour for the rental (360° only, no plan => has_360 without has_3d)
do $$
declare
  v_tour uuid := '00000000-0000-4000-9000-000000000002';
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
begin
  insert into public.property_3d_tours (id, property_id, title, status, is_verified)
  values (v_tour, '00000000-0000-4000-f000-000000000003', 'Visite 360°', 'draft', false);
  insert into public.property_360_scenes (id, tour_id, name, panorama_url, position) values
    (s1, v_tour, 'Séjour', pg_temp.pano('aft_lounge'), 0),
    (s2, v_tour, 'Chambre', pg_temp.pano('hotel_room'), 1);
  insert into public.property_hotspots (scene_id, kind, target_scene_id, yaw, pitch, label, icon) values
    (s1, 'navigation', s2, 60, -6, 'Chambre', 'bedroom'),
    (s2, 'navigation', s1, -120, -6, 'Séjour', 'living');
  update public.property_3d_tours set start_scene_id = s1, status = 'published' where id = v_tour;
end $$;

-- Copy the Palmeraie tour structure onto "Villa Contemporaine Sahara" so both reference screens work
do $$
declare
  v_src uuid := '00000000-0000-4000-9000-000000000001';
  v_dst uuid := '00000000-0000-4000-9000-000000000003';
  m_plan jsonb := '{}'; m_room jsonb := '{}'; m_scene jsonb := '{}';
  r record; v_new uuid;
begin
  insert into public.property_3d_tours (id, property_id, title, status, is_verified)
  values (v_dst, '00000000-0000-4000-f000-000000000002', 'Visite 3D & 360°', 'draft', true);
  for r in select * from public.property_floor_plans where tour_id = v_src loop
    insert into public.property_floor_plans (tour_id, level, name, name_ar, scale_label, width_m, depth_m)
    values (v_dst, r.level, r.name, r.name_ar, r.scale_label, r.width_m, r.depth_m) returning id into v_new;
    m_plan := m_plan || jsonb_build_object(r.id::text, v_new);
  end loop;
  for r in select * from public.property_rooms where tour_id = v_src loop
    insert into public.property_rooms (tour_id, floor_plan_id, name, name_ar, room_type, area_m2, length_m, width_m, ceiling_height_m, material, plan_rect, position)
    values (v_dst, (m_plan ->> r.floor_plan_id::text)::uuid, r.name, r.name_ar, r.room_type, r.area_m2, r.length_m, r.width_m, r.ceiling_height_m, r.material, r.plan_rect, r.position)
    returning id into v_new;
    m_room := m_room || jsonb_build_object(r.id::text, v_new);
  end loop;
  for r in select * from public.property_360_scenes where tour_id = v_src loop
    insert into public.property_360_scenes (tour_id, room_id, name, panorama_url, initial_yaw, position)
    values (v_dst, (m_room ->> r.room_id::text)::uuid, r.name, r.panorama_url, r.initial_yaw, r.position) returning id into v_new;
    m_scene := m_scene || jsonb_build_object(r.id::text, v_new);
  end loop;
  insert into public.property_hotspots (scene_id, kind, target_scene_id, yaw, pitch, label, label_ar, icon)
  select (m_scene ->> h.scene_id::text)::uuid, h.kind, (m_scene ->> h.target_scene_id::text)::uuid, h.yaw, h.pitch, h.label, h.label_ar, h.icon
  from public.property_hotspots h join public.property_360_scenes s on s.id = h.scene_id where s.tour_id = v_src;
  update public.property_3d_tours
    set start_scene_id = (m_scene ->> '00000000-0000-4000-9200-000000000001')::uuid, status = 'published'
  where id = v_dst;
end $$;

-- A few demo verifications & a report so the admin queues are not empty
insert into public.verifications (subject_type, subject_id, requested_by, status) values
  ('property', '00000000-0000-4000-f000-000000000007', '00000000-0000-4000-a000-000000000003', 'pending'),
  ('documents', '00000000-0000-4000-f000-000000000004', '00000000-0000-4000-a000-000000000003', 'pending');

insert into public.reports (reporter_id, property_id, reason, details) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-f000-000000000009', 'wrong_price', 'Signalement de démonstration.');
