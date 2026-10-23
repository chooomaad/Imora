-- Imora — extensions & enums
-- Keep enums in sync with packages/shared/src/domain.ts

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('client', 'proprietaire', 'agent', 'agency_admin', 'developer', 'admin');
create type public.listing_type as enum ('sale', 'rent', 'investment');
create type public.property_type as enum ('apartment', 'villa', 'house', 'land', 'office', 'retail', 'building', 'project');
create type public.property_status as enum ('draft', 'pending_review', 'published', 'rejected', 'archived', 'sold', 'rented');
create type public.price_period as enum ('total', 'month', 'year');
create type public.media_kind as enum ('image', 'video', 'panorama', 'model', 'floor_plan');

create type public.tour_status as enum ('draft', 'published');
create type public.tour_source as enum ('manual_360', 'photogrammetry', 'lidar', 'generated');
create type public.hotspot_kind as enum ('navigation', 'info', 'measure');

create type public.contact_event_type as enum ('phone_reveal', 'whatsapp_click', 'call_click', 'message_sent', 'visit_requested');
create type public.lead_source as enum ('phone_reveal', 'whatsapp_click', 'call_click', 'message_sent', 'visit_requested', 'favorite', 'info_request');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'visit_scheduled', 'negotiation', 'converted', 'lost');
create type public.visit_status as enum ('requested', 'confirmed', 'cancelled', 'completed', 'no_show');

create type public.verification_subject as enum ('owner', 'agency', 'property', 'documents', 'tour', 'developer');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.document_type as enum ('title_deed', 'cadastre', 'building_permit', 'identity', 'mandate', 'other');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create type public.transaction_type as enum ('sale', 'rent');
create type public.transaction_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'disputed');
create type public.commission_method as enum ('percentage', 'fixed', 'rent_fraction');
create type public.commission_payment_status as enum ('unpaid', 'pending', 'paid', 'waived');

create type public.subscription_status as enum ('active', 'past_due', 'cancelled', 'expired');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.payment_provider as enum ('bankily', 'masrvi', 'sedad', 'bank_transfer', 'cash', 'card');

create type public.unit_status as enum ('available', 'reserved', 'sold');
create type public.project_status as enum ('planned', 'under_construction', 'delivered');
create type public.suggestion_status as enum ('pending', 'accepted', 'edited', 'rejected');
