-- People On performance helpers.
-- Run this in Supabase SQL Editor before or alongside performance-related releases.

create index if not exists idx_interaction_logs_entity_created_at
    on public.interaction_logs(entity_id, created_at desc);

create index if not exists idx_member_payments_entity_sort
    on public.member_payments(entity_id, sort_order);

create index if not exists idx_member_payments_entity_type
    on public.member_payments(entity_id, payment_type);

create index if not exists idx_member_payments_entity_paid_date
    on public.member_payments(entity_id, paid_date desc);

create index if not exists idx_settlement_cases_entity_created_at
    on public.settlement_cases(entity_id, created_at desc);

create index if not exists idx_settlement_lines_case_type
    on public.settlement_lines(case_id, line_type);

create index if not exists idx_refund_payments_case_status
    on public.refund_payments(case_id, payment_status);

create or replace view public.vw_latest_interaction_log_by_entity
with (security_invoker = true) as
with ranked_logs as (
    select
        il.id,
        il.entity_id,
        il.type,
        il.direction,
        il.summary,
        il.staff_name,
        il.created_at,
        row_number() over (
            partition by il.entity_id
            order by il.created_at desc, il.id desc
        ) as row_number
    from public.interaction_logs il
    where il.entity_id is not null
      and coalesce(il.staff_name, '') <> '이전시스템기록'
      and il.created_at >= timestamptz '2026-03-10 00:00:00+00'
)
select
    id,
    entity_id,
    type,
    direction,
    summary,
    staff_name,
    created_at
from ranked_logs
where row_number = 1;

create or replace view public.vw_member_payment_entity_summary
with (security_invoker = true) as
select
    mp.entity_id,
    count(*)::bigint as payment_count,
    coalesce(sum(coalesce(mp.amount_due, 0)), 0) as total_due,
    coalesce(sum(coalesce(mp.amount_paid, 0)), 0) as total_paid,
    coalesce(
        sum(coalesce(mp.amount_due, 0)) filter (
            where mp.is_contribution = true
              and mp.payment_type <> 'premium'
              and not (
                  mp.payment_type = 'other'
                  and mp.receipt_note = '__system_union_fee_included__'
              )
        ),
        0
    ) as contribution_due_base,
    coalesce(
        sum(coalesce(mp.amount_paid, 0)) filter (
            where mp.is_contribution = true
              and mp.payment_type <> 'premium'
              and not (
                  mp.payment_type = 'other'
                  and mp.receipt_note = '__system_union_fee_included__'
              )
        ),
        0
    ) as contribution_paid_base,
    coalesce(
        sum(coalesce(mp.amount_paid, 0)) filter (where mp.payment_type = 'certificate'),
        0
    ) as certificate_paid,
    coalesce(
        sum(coalesce(mp.amount_paid, 0)) filter (where mp.payment_type = 'premium_recognized'),
        0
    ) as premium_recognized_paid,
    coalesce(
        sum(coalesce(mp.amount_paid, 0)) filter (
            where mp.payment_type = 'other'
              and mp.receipt_note = '__system_union_fee_included__'
        ),
        0
    ) as union_fee_actual_paid,
    count(*) filter (
        where mp.payment_type = 'other'
          and mp.receipt_note = '__system_union_fee_included__'
    )::bigint as union_fee_count,
    count(*) filter (
        where mp.payment_type in ('certificate', 'contract', 'installment_1', 'installment_2', 'balance')
    )::bigint as structured_count,
    max(mp.paid_date) as latest_paid_date,
    coalesce(
        array_remove(
            array_agg(distinct coalesce(ut.name, mp.unit_type_id::text)) filter (where mp.unit_type_id is not null),
            null
        ),
        '{}'::text[]
    ) as unit_type_names,
    coalesce(
        array_remove(
            array_agg(distinct coalesce(da.account_name, '미지정')) filter (
                where coalesce(mp.amount_paid, 0) > 0
                  and mp.deposit_account_id is not null
            ),
            null
        ),
        '{}'::text[]
    ) as account_names
from public.member_payments mp
left join public.unit_types ut
    on ut.id = mp.unit_type_id
   and ut.is_active = true
left join public.deposit_accounts da
    on da.id = mp.deposit_account_id
   and da.is_active = true
where mp.entity_id is not null
group by mp.entity_id;

create or replace view public.vw_dashboard_payment_total_summary
with (security_invoker = true) as
select
    coalesce(sum(coalesce(amount_due, 0)), 0) as total_due,
    coalesce(sum(coalesce(amount_paid, 0)), 0) as total_paid
from public.payments;

create or replace view public.vw_dashboard_payment_step_summary
with (security_invoker = true) as
select
    case
        when step = 1 then 'step1'
        when step = 2 then 'step2'
        when step = 3 then 'step3'
        when step > 3 then 'general'
        else 'unassigned'
    end as bucket,
    coalesce(sum(coalesce(amount_due, 0)), 0) as due,
    coalesce(sum(coalesce(amount_paid, 0)), 0) as paid
from public.payments
group by 1;

create or replace view public.vw_member_payment_financial_total_summary
with (security_invoker = true) as
select
    count(*)::bigint as payment_count,
    coalesce(
        sum(coalesce(amount_due, 0)) filter (
            where is_contribution = true
              and payment_type <> 'premium'
        ),
        0
    ) as contribution_due,
    coalesce(
        sum(coalesce(amount_paid, 0)) filter (
            where is_contribution = true
              and payment_type <> 'premium'
        ),
        0
    ) as contribution_paid,
    coalesce(
        sum(coalesce(amount_paid, 0)) filter (where payment_type = 'certificate'),
        0
    ) as certificate_paid,
    coalesce(
        sum(coalesce(amount_paid, 0)) filter (where payment_type = 'premium_recognized'),
        0
    ) as premium_recognized_paid
from public.member_payments;

create or replace view public.vw_member_payment_type_summary
with (security_invoker = true) as
select
    payment_type,
    coalesce(sum(coalesce(amount_due, 0)), 0) as due,
    coalesce(sum(coalesce(amount_paid, 0)), 0) as paid
from public.member_payments
group by payment_type;

create or replace view public.vw_member_payment_unit_type_summary
with (security_invoker = true) as
select
    coalesce(ut.name, '미정') as unit_type_name,
    coalesce(sum(coalesce(mp.amount_due, 0)), 0) as due,
    coalesce(sum(coalesce(mp.amount_paid, 0)), 0) as paid,
    count(*)::bigint as count
from public.member_payments mp
left join public.unit_types ut
    on ut.id = mp.unit_type_id
   and ut.is_active = true
where mp.unit_type_id is not null
group by coalesce(ut.name, '미정');

create or replace view public.vw_member_payment_account_summary
with (security_invoker = true) as
select
    coalesce(da.account_name, '미지정') as account_name,
    coalesce(da.account_type, 'unknown') as account_type,
    coalesce(sum(coalesce(mp.amount_paid, 0)), 0) as total
from public.member_payments mp
left join public.deposit_accounts da
    on da.id = mp.deposit_account_id
   and da.is_active = true
where mp.deposit_account_id is not null
  and coalesce(mp.amount_paid, 0) > 0
group by coalesce(da.account_name, '미지정'), coalesce(da.account_type, 'unknown');

create or replace view public.vw_settlement_case_amount_summary
with (security_invoker = true) as
with final_lines as (
    select
        case_id,
        coalesce(sum(coalesce(amount, 0)), 0) as expected
    from public.settlement_lines
    where line_type = 'final_refund'
    group by case_id
),
paid_payments as (
    select
        case_id,
        coalesce(sum(coalesce(paid_amount, 0)), 0) as paid
    from public.refund_payments
    where payment_status = 'paid'
    group by case_id
)
select
    sc.id as case_id,
    coalesce(fl.expected, 0) as expected,
    coalesce(pp.paid, 0) as paid
from public.settlement_cases sc
left join final_lines fl
    on fl.case_id = sc.id
left join paid_payments pp
    on pp.case_id = sc.id;

create or replace view public.vw_latest_settlement_case_by_entity
with (security_invoker = true) as
with ranked_cases as (
    select
        sc.id,
        sc.entity_id,
        sc.case_status,
        sc.created_at,
        row_number() over (
            partition by sc.entity_id
            order by sc.created_at desc, sc.id desc
        ) as row_number
    from public.settlement_cases sc
    where sc.entity_id is not null
)
select
    id,
    entity_id,
    case_status,
    created_at
from ranked_cases
where row_number = 1;

create or replace view public.vw_settlement_case_line_type_summary
with (security_invoker = true) as
select
    case_id,
    line_type,
    coalesce(sum(coalesce(amount, 0)), 0) as amount
from public.settlement_lines
group by case_id, line_type;

create or replace view public.vw_settlement_case_payment_status_summary
with (security_invoker = true) as
select
    case_id,
    payment_status,
    coalesce(sum(coalesce(paid_amount, 0)), 0) as paid_amount
from public.refund_payments
group by case_id, payment_status;

grant select on public.vw_latest_interaction_log_by_entity to authenticated;
grant select on public.vw_member_payment_entity_summary to authenticated;
grant select on public.vw_dashboard_payment_total_summary to authenticated;
grant select on public.vw_dashboard_payment_step_summary to authenticated;
grant select on public.vw_member_payment_financial_total_summary to authenticated;
grant select on public.vw_member_payment_type_summary to authenticated;
grant select on public.vw_member_payment_unit_type_summary to authenticated;
grant select on public.vw_member_payment_account_summary to authenticated;
grant select on public.vw_settlement_case_amount_summary to authenticated;
grant select on public.vw_latest_settlement_case_by_entity to authenticated;
grant select on public.vw_settlement_case_line_type_summary to authenticated;
grant select on public.vw_settlement_case_payment_status_summary to authenticated;
