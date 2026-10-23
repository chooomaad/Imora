-- Imora — default configuration. All values are editable from the admin
-- dashboard (app_settings / commission_rules / subscription_plans).

insert into public.app_settings (key, value, description) values
  ('auto_publish', 'false', 'Publish new listings without admin moderation'),
  ('visit_slots', '["10:00", "11:30", "15:00", "17:00"]', 'Bookable physical-visit time slots'),
  ('phone_reveal_daily_limit', '30', 'Max owner phone reveals per user per 24h'),
  ('timezone', '"Africa/Nouakchott"', 'Platform timezone'),
  ('commission_payer', '"seller"', 'Who pays Imora''s commission: seller or buyer'),
  ('ai_daily_limit', '40', 'Max AI requests per user (or IP) per 24h')
on conflict (key) do nothing;

-- Initial commission rules (admin can deactivate/replace them; never hard-coded in the apps)
insert into public.commission_rules (name, transaction_type, method, rate, rent_fraction, priority) values
  ('Vente — standard', 'sale', 'percentage', 0.01, null, 0),
  ('Location — moitié du premier loyer', 'rent', 'rent_fraction', null, 0.5, 0);

insert into public.subscription_plans (code, audience, name, name_ar, price_monthly, features, sort_order) values
  ('client_free', 'client', 'Client', 'عميل', 0, '{"saved_searches": 10, "comparisons": true}', 0),
  ('owner_free', 'proprietaire', 'Propriétaire', 'مالك', 0, '{"active_listings": 3, "basic_stats": true}', 1),
  ('owner_premium', 'proprietaire', 'Propriétaire Premium', 'مالك مميز', 1500, '{"active_listings": 20, "featured_listings": 2, "advanced_stats": true, "premium_badge": true}', 2),
  ('agency_basic', 'agency_admin', 'Agence Basic', 'وكالة أساسية', 5000, '{"active_listings": 50, "agents": 3, "basic_stats": true}', 3),
  ('agency_pro', 'agency_admin', 'Agence Pro', 'وكالة احترافية', 15000, '{"active_listings": 500, "agents": 25, "featured_listings": 15, "advanced_stats": true, "advanced_leads": true, "tour_generation": true, "premium_badge": true}', 4),
  ('developer_business', 'developer', 'Promoteur Business', 'مطور أعمال', 25000, '{"projects": 20, "featured_listings": 10, "advanced_stats": true, "tour_generation": true, "renders_3d": true}', 5)
on conflict (code) do nothing;
