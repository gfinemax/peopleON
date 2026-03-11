-- =====================================================
-- Certificate Registry + Person Summary
-- =====================================================
-- 목적
-- 1) asset_rights / member_number 를 권리증 후보 source 로 통합 관리
-- 2) 사람별 provisional 권리증 개수를 registry 에서 계산
-- 3) 사람이 수동으로 최종 확정 개수를 저장할 수 있는 summary 테이블 제공
-- 4) finance / members 화면에서 사용할 rollup view 제공

create extension if not exists pgcrypto;

create table if not exists public.certificate_registry (
    id uuid primary key default gen_random_uuid(),
    entity_id uuid not null references public.account_entities(id) on delete cascade,
    certificate_number_raw text,
    certificate_number_normalized text,
    certificate_status text not null check (
        certificate_status in (
            'confirmed',
            'declared_owned',
            'pending',
            'missing',
            'invalid',
            'review_required'
        )
    ),
    source_type text not null check (
        source_type in ('asset_rights', 'member_number', 'manual')
    ),
    source_ref_id uuid,
    is_confirmed_for_count boolean not null default false,
    is_active boolean not null default true,
    review_status text not null default 'auto' check (
        review_status in ('auto', 'reviewed', 'manual_locked')
    ),
    merge_key text,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_certificate_registry_entity_id
    on public.certificate_registry(entity_id);

create index if not exists idx_certificate_registry_normalized
    on public.certificate_registry(certificate_number_normalized);

create index if not exists idx_certificate_registry_source
    on public.certificate_registry(source_type, source_ref_id);

create unique index if not exists uq_certificate_registry_source_ref
    on public.certificate_registry(source_type, source_ref_id)
    where source_ref_id is not null;

create table if not exists public.person_certificate_summaries (
    id uuid primary key default gen_random_uuid(),
    entity_id uuid not null unique references public.account_entities(id) on delete cascade,
    owner_group text not null check (owner_group in ('registered', 'others')),
    provisional_certificate_count integer not null default 0,
    manual_certificate_count integer,
    review_status text not null default 'pending' check (
        review_status in ('pending', 'reviewed', 'manual_locked')
    ),
    conflict_certificate_count integer not null default 0,
    summary_note text,
    source_snapshot jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_person_certificate_summaries_owner_group
    on public.person_certificate_summaries(owner_group);

create index if not exists idx_person_certificate_summaries_review_status
    on public.person_certificate_summaries(review_status);

create or replace view public.vw_person_certificate_registry_provisional as
with base_entities as (
    select
        ae.id as entity_id,
        ae.display_name,
        case
            when exists (
                select 1
                from public.membership_roles mr
                where mr.entity_id = ae.id
                  and mr.is_registered = true
                  and coalesce(mr.role_status, 'active') = 'active'
            ) then 'registered'
            else 'others'
        end as owner_group
    from public.account_entities ae
    where ae.entity_type = 'person'
      and (
        exists (
            select 1
            from public.membership_roles mr
            where mr.entity_id = ae.id
              and coalesce(mr.role_status, 'active') = 'active'
        )
        or exists (
            select 1
            from public.certificate_registry cr
            where cr.entity_id = ae.id
              and cr.is_active = true
        )
        or exists (
            select 1
            from public.person_certificate_summaries pcs
            where pcs.entity_id = ae.id
        )
      )
), conflicting_numbers as (
    select cr.certificate_number_normalized
    from public.certificate_registry cr
    join public.account_entities ae
      on ae.id = cr.entity_id
    where cr.is_active = true
      and cr.is_confirmed_for_count = true
      and cr.certificate_status = 'confirmed'
      and coalesce(cr.certificate_number_normalized, '') <> ''
    group by cr.certificate_number_normalized
    having count(distinct ae.display_name) > 1
), dedup_numbers as (
    select distinct
        cr.entity_id,
        cr.certificate_number_normalized
    from public.certificate_registry cr
    where cr.is_active = true
      and cr.is_confirmed_for_count = true
      and cr.certificate_status = 'confirmed'
      and coalesce(cr.certificate_number_normalized, '') <> ''
)
select
    be.entity_id,
    be.display_name,
    be.owner_group,
    count(dn.certificate_number_normalized)::int as provisional_certificate_count,
    count(dn.certificate_number_normalized) filter (
        where dn.certificate_number_normalized in (
            select certificate_number_normalized from conflicting_numbers
        )
    )::int as conflict_certificate_count,
    coalesce(
        array_agg(dn.certificate_number_normalized order by dn.certificate_number_normalized)
            filter (where dn.certificate_number_normalized is not null),
        array[]::text[]
    ) as provisional_certificate_numbers
from base_entities be
left join dedup_numbers dn
  on dn.entity_id = be.entity_id
group by be.entity_id, be.display_name, be.owner_group;

comment on view public.vw_person_certificate_registry_provisional is
'certificate_registry 기준 사람별 provisional 권리증 개수와 충돌 개수';

create or replace view public.vw_person_certificate_summary_current as
with provisional as (
    select *
    from public.vw_person_certificate_registry_provisional
)
select
    p.entity_id,
    p.display_name,
    coalesce(pcs.owner_group, p.owner_group) as owner_group,
    p.provisional_certificate_count,
    pcs.manual_certificate_count,
    coalesce(pcs.manual_certificate_count, p.provisional_certificate_count) as effective_certificate_count,
    coalesce(pcs.review_status, 'pending') as review_status,
    coalesce(pcs.conflict_certificate_count, p.conflict_certificate_count) as conflict_certificate_count,
    pcs.summary_note,
    p.provisional_certificate_numbers,
    pcs.updated_at as summary_updated_at
from provisional p
left join public.person_certificate_summaries pcs
  on pcs.entity_id = p.entity_id;

comment on view public.vw_person_certificate_summary_current is
'사람별 provisional/manual/effective 권리증 개수 통합 뷰';

create or replace view public.vw_person_certificate_rollup as
select
    owner_group,
    count(*)::int as owner_count,
    count(*) filter (where effective_certificate_count > 0)::int as owner_with_certificate_count,
    coalesce(sum(provisional_certificate_count), 0)::int as provisional_certificate_count,
    coalesce(sum(effective_certificate_count), 0)::int as effective_certificate_count,
    coalesce(sum(conflict_certificate_count), 0)::int as conflict_certificate_count,
    count(*) filter (where review_status = 'manual_locked')::int as manual_locked_count,
    count(*) filter (where review_status <> 'manual_locked')::int as pending_review_count
from public.vw_person_certificate_summary_current
group by owner_group;

comment on view public.vw_person_certificate_rollup is
'registered / others 기준 사람수, provisional/effective 권리증 수, 수동잠금/검수대기 집계';

insert into public.person_certificate_summaries (
    entity_id,
    owner_group,
    provisional_certificate_count,
    conflict_certificate_count,
    source_snapshot
)
select
    entity_id,
    owner_group,
    provisional_certificate_count,
    conflict_certificate_count,
    jsonb_build_object(
        'provisional_certificate_numbers', provisional_certificate_numbers,
        'seeded_from', 'vw_person_certificate_registry_provisional',
        'seeded_at', now()
    )
from public.vw_person_certificate_registry_provisional
on conflict (entity_id) do update
set
    owner_group = excluded.owner_group,
    provisional_certificate_count = excluded.provisional_certificate_count,
    conflict_certificate_count = excluded.conflict_certificate_count,
    source_snapshot = excluded.source_snapshot,
    updated_at = now();
