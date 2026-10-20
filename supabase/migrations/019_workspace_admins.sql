-- Workspace admins: the owner can promote members to admin.
-- Admins manage people, invites, pipeline mode and see the Workspace page; billing/seats and promotions stay with the owner.
alter table public.workspace_members
  add column if not exists is_admin boolean not null default false;

notify pgrst, 'reload schema';
