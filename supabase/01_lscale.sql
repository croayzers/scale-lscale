-- ============================================================
-- L-Scale (Logistic Scale) — Migración inicial
-- Schema: lscale.*
-- Ejecutar en Supabase SQL Editor del proyecto "Scale"
-- ============================================================

create schema if not exists lscale;

-- ── Config de empresa para L-Scale ────────────────────────────────────────
create table if not exists lscale.empresa_config (
  id          bigint generated always as identity primary key,
  company_id  uuid   not null references public.companies(id) on delete cascade,
  col_config  jsonb  not null default '{}',
  created_at  timestamptz default now(),
  unique (company_id)
);

-- ── Materiales / artículos del almacén ────────────────────────────────────
create table if not exists lscale.materiales (
  id           bigint generated always as identity primary key,
  company_id   uuid   not null references public.companies(id) on delete cascade,
  referencia   text,
  nombre       text   not null,
  descripcion  text,
  categoria    text,
  unidad       text   not null default 'ud',
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  ubicacion    text,
  estado       text   not null default 'activo',
  proveedor    text,
  precio_coste numeric,
  notas        text,
  created_at   timestamptz default now()
);

-- ── Pedidos / órdenes ─────────────────────────────────────────────────────
create table if not exists lscale.pedidos (
  id             bigint generated always as identity primary key,
  company_id     uuid   not null references public.companies(id) on delete cascade,
  codigo         text,
  nombre         text,
  fecha_pedido   date,
  fecha_entrega  date,
  estado         text not null default 'borrador',
  destino        text,
  notas          text,
  datos          jsonb not null default '{}',
  created_at     timestamptz default now()
);

-- ── Expediciones ──────────────────────────────────────────────────────────
create table if not exists lscale.expediciones (
  id             bigint generated always as identity primary key,
  company_id     uuid   not null references public.companies(id) on delete cascade,
  pedido_id      bigint references lscale.pedidos(id) on delete set null,
  codigo         text,
  fecha_salida   timestamptz,
  fecha_retorno  timestamptz,
  estado         text not null default 'preparando',
  destino        text,
  responsable    text,
  vehiculo       text,
  datos          jsonb not null default '{}',
  created_at     timestamptz default now()
);

-- ── Movimientos de stock (entradas / salidas / retornos) ──────────────────
create table if not exists lscale.movimientos (
  id             bigint generated always as identity primary key,
  company_id     uuid   not null references public.companies(id) on delete cascade,
  material_id    bigint references lscale.materiales(id) on delete cascade,
  expedicion_id  bigint references lscale.expediciones(id) on delete set null,
  tipo           text   not null,   -- entrada | salida | retorno | ajuste
  cantidad       numeric not null,
  fecha          timestamptz default now(),
  notas          text
);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table lscale.empresa_config  enable row level security;
alter table lscale.materiales      enable row level security;
alter table lscale.pedidos         enable row level security;
alter table lscale.expediciones    enable row level security;
alter table lscale.movimientos     enable row level security;

-- Políticas: el usuario solo ve datos de sus empresas (vía company_members).
-- La app usa service_role para escrituras (bypass RLS), igual que P-Scale.

create policy "user sees own empresa_config"
  on lscale.empresa_config for select
  using (company_id in (
    select company_id from public.company_members where user_id = auth.uid()
  ));

create policy "user sees own materiales"
  on lscale.materiales for select
  using (company_id in (
    select company_id from public.company_members where user_id = auth.uid()
  ));

create policy "user sees own pedidos"
  on lscale.pedidos for select
  using (company_id in (
    select company_id from public.company_members where user_id = auth.uid()
  ));

create policy "user sees own expediciones"
  on lscale.expediciones for select
  using (company_id in (
    select company_id from public.company_members where user_id = auth.uid()
  ));

create policy "user sees own movimientos"
  on lscale.movimientos for select
  using (company_id in (
    select company_id from public.company_members where user_id = auth.uid()
  ));

-- ── Expose schema to PostgREST (anon + service_role) ─────────────────────
grant usage on schema lscale to anon, authenticated, service_role;
grant all   on all tables    in schema lscale to service_role;
grant select on all tables   in schema lscale to authenticated;
grant all   on all sequences in schema lscale to service_role;
