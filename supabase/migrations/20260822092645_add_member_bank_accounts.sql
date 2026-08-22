create table if not exists public.member_bank_accounts (
    id uuid primary key default gen_random_uuid(),
    entity_id uuid not null unique references public.account_entities(id) on delete cascade,
    bank_name text not null,
    account_number text not null,
    account_holder text not null,
    purpose text not null default 'refund' check (purpose in ('refund', 'payment', 'other')),
    created_by text not null,
    updated_by text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint member_bank_accounts_bank_name_not_blank check (btrim(bank_name) <> ''),
    constraint member_bank_accounts_number_not_blank check (btrim(account_number) <> ''),
    constraint member_bank_accounts_holder_not_blank check (btrim(account_holder) <> '')
);

alter table public.member_bank_accounts enable row level security;

revoke all on table public.member_bank_accounts from anon, authenticated;
grant all on table public.member_bank_accounts to service_role;

create index if not exists idx_member_bank_accounts_updated_at
    on public.member_bank_accounts(updated_at desc);

comment on table public.member_bank_accounts is '회원별 환불 및 지급 계좌. 서버 전용 API를 통해서만 접근한다.';
