-- =========================================================
-- UF2 - ERP Achats - Schéma Phase 1
-- À coller dans Supabase > SQL Editor > New query > Run
-- =========================================================

-- Profils utilisateurs (nom affiché, rôle)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  nom text,
  role text default 'acheteur',
  created_at timestamptz default now()
);

-- Création automatique du profil à l'inscription d'un utilisateur
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nom) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fournisseurs
create table if not exists fournisseurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  contact text,
  telephone text,
  email text,
  adresse text,
  conditions_paiement_jours int default 30,
  remise_par_defaut_pct numeric default 0,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

-- Articles
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  designation text not null,
  unite text,
  categorie text,
  dernier_prix_ht numeric,
  dernier_fournisseur_id uuid references fournisseurs(id),
  date_dernier_achat date,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

-- Journal d'audit (qui a fait quoi, quand)
create table if not exists journal_audit (
  id bigint generated always as identity primary key,
  utilisateur_id uuid references auth.users,
  action text,
  entite text,
  entite_id uuid,
  details jsonb,
  date_heure timestamptz default now()
);

-- Fonction générique d'audit
create or replace function public.audit_log()
returns trigger as $$
begin
  insert into journal_audit(utilisateur_id, action, entite, entite_id, details)
  values (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end
  );
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$ language plpgsql security definer;

drop trigger if exists fournisseurs_audit on fournisseurs;
create trigger fournisseurs_audit
  after insert or update or delete on fournisseurs
  for each row execute procedure public.audit_log();

drop trigger if exists articles_audit on articles;
create trigger articles_audit
  after insert or update or delete on articles
  for each row execute procedure public.audit_log();

-- Activation de la sécurité au niveau des lignes (RLS)
alter table profiles enable row level security;
alter table fournisseurs enable row level security;
alter table articles enable row level security;
alter table journal_audit enable row level security;

-- Politiques : seuls les utilisateurs connectés (comptes créés par toi) peuvent lire/écrire
create policy "profiles_read" on profiles for select using (auth.role() = 'authenticated');

create policy "fournisseurs_all" on fournisseurs for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "articles_all" on articles for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "audit_read" on journal_audit for select
  using (auth.role() = 'authenticated');
