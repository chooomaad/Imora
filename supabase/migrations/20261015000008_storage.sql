-- Imora — Storage buckets & policies.
-- Path convention: <owner entity id>/<file>. The first folder decides permissions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('property-images', 'property-images', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('property-videos', 'property-videos', true, 209715200, array['video/mp4', 'video/webm', 'video/quicktime']),
  ('property-360', 'property-360', true, 52428800, array['image/jpeg', 'image/png', 'image/webp']),
  ('property-3d', 'property-3d', true, 209715200, array['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']),
  ('floor-plans', 'floor-plans', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']),
  ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('agency-assets', 'agency-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('project-assets', 'project-assets', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'model/gltf-binary'])
on conflict (id) do nothing;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- Public read on public buckets is handled by the bucket "public" flag.

create policy "property media upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('property-images', 'property-videos', 'property-360', 'property-3d', 'floor-plans')
              and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "property media update" on storage.objects for update to authenticated
  using (bucket_id in ('property-images', 'property-videos', 'property-360', 'property-3d', 'floor-plans')
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "property media delete" on storage.objects for delete to authenticated
  using (bucket_id in ('property-images', 'property-videos', 'property-360', 'property-3d', 'floor-plans')
         and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));

-- Private property documents (title deeds, cadastre...): managers + admins only.
create policy "documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));
create policy "documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_manage_property(public.try_uuid((storage.foldername(name))[1])));

create policy "avatars own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "agency assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'agency-assets' and public.is_agency_admin(public.try_uuid((storage.foldername(name))[1])));
create policy "agency assets delete" on storage.objects for delete to authenticated
  using (bucket_id = 'agency-assets' and public.is_agency_admin(public.try_uuid((storage.foldername(name))[1])));

create policy "project assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-assets' and public.can_manage_project(public.try_uuid((storage.foldername(name))[1])));
create policy "project assets delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-assets' and public.can_manage_project(public.try_uuid((storage.foldername(name))[1])));

-- Private message attachments: <conversation_id>/<file>, readable by the two participants only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('message-attachments', 'message-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = p_conversation_id and auth.uid() in (client_id, counterpart_id))
$$;

create policy "message attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments' and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));
create policy "message attachments upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments' and public.is_conversation_participant(public.try_uuid((storage.foldername(name))[1])));
