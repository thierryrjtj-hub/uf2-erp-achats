-- =========================================================
-- UF2 - ERP Achats - Schéma Phase 2 (Demandes + TCO)
-- À coller dans Supabase > SQL Editor > New query > Run
-- (à exécuter APRÈS le script de la Phase 1)
-- =========================================================

-- Séquence pour la numérotation automatique des demandes
create sequence if not exists seq_demandes start 1;

create or replace function public.next_numero_demande()
returns text as $$
declare
  n int;
begin
  n := nextval('seq_demandes');
  return 'DDP-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::text, 4, '0');
end;
$$ language plpgsql;

-- Demandes d'achat
create table if not exists demandes (
  id uuid primary key default gen_random_uuid(),
  numero text not null default public.next_numero_demande(),
  date date not null default current_date,
  service text,
  demandeur text,
  motif_projet text,
  statut text default 'A faire',
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

-- Lignes d'une demande (articles demandés)
create table if not exists lignes_demande (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes(id) on delete cascade,
  article_id uuid references articles(id),
  designation text not null,
  quantite numeric not null default 1,
  unite text,
  created_at timestamptz default now()
);

-- Offres reçues des fournisseurs pour une demande (une par fournisseur)
create table if not exists offres (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes(id) on delete cascade,
  fournisseur_id uuid references fournisseurs(id),
  fournisseur_nom text,
  created_at timestamptz default now(),
  created_by uuid references auth.users
);

-- Prix proposé par une offre, ligne par ligne
create table if not exists lignes_offre (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid references offres(id) on delete cascade,
  ligne_demande_id uuid references lignes_demande(id) on delete cascade,
  prix_unitaire_ht numeric,
  remise_pct numeric default 0,
  updated_at timestamptz default now()
);

-- Audit sur les 4 nouvelles tables
drop trigger if exists demandes_audit on demandes;
create trigger demandes_audit
  after insert or update or delete on demandes
  for each row execute procedure public.audit_log();

drop trigger if exists lignes_demande_audit on lignes_demande;
create trigger lignes_demande_audit
  after insert or update or delete on lignes_demande
  for each row execute procedure public.audit_log();

drop trigger if exists offres_audit on offres;
create trigger offres_audit
  after insert or update or delete on offres
  for each row execute procedure public.audit_log();

drop trigger if exists lignes_offre_audit on lignes_offre;
create trigger lignes_offre_audit
  after insert or update or delete on lignes_offre
  for each row execute procedure public.audit_log();

-- RLS
alter table demandes enable row level security;
alter table lignes_demande enable row level security;
alter table offres enable row level security;
alter table lignes_offre enable row level security;

create policy "demandes_all" on demandes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "lignes_demande_all" on lignes_demande for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "offres_all" on offres for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "lignes_offre_all" on lignes_offre for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
