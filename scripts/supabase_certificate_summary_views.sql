-- =====================================================
-- Certificate Summary Views for Supabase
-- =====================================================
-- 목적:
-- 1) 조합원 상태 6종 기준으로 권리증 개수 집계
-- 2) 등기조합원116 vs 그외 권리증 총계 집계
-- 3) 환불자 우선관리 목록 조회용 뷰 제공
--
-- 전제:
-- - legacy_records.rights_count 는 "권리증번호 기준 개수"로 보정되어 있어야 정확함
--   (scripts/recalculate_rights_count_from_cert_numbers.py --run)
--
-- 상태 분류 규칙 (프론트엔드와 동일):
-- - is_refunded = true                  -> refunded
-- - members.is_registered = true        -> registered_116
-- - members.tier ILIKE '%2차%'          -> second_member
-- - members.tier ILIKE '%지주%'          -> landlord_member
-- - members.tier ILIKE '%일반%'          -> general_sale
-- - 그 외                                -> reserve_member
--
-- 상태 코드/라벨 매핑:
-- registered_116 -> 등기조합원116
-- reserve_member -> 예비조합원
-- second_member  -> 2차조합원
-- landlord_member-> 지주조합원
-- general_sale   -> 일반분양
-- refunded       -> 환불자
-- =====================================================

-- 권장 인덱스 (없는 경우 생성)
create index if not exists idx_legacy_records_member_id
  on legacy_records(member_id);

create index if not exists idx_legacy_records_is_refunded
  on legacy_records(is_refunded);

create index if not exists idx_legacy_records_original_name
  on legacy_records(original_name);

create index if not exists idx_members_id_tier_registered
  on members(id, tier, is_registered);

-- -----------------------------------------------------
-- 1) 상세 베이스 뷰
-- -----------------------------------------------------
create or replace view vw_certificate_segment_base as
select
  lr.id as legacy_record_id,
  lr.original_name,
  lr.source_file,
  lr.member_id,
  lr.is_refunded,
  greatest(coalesce(lr.rights_count, 0), 0)::int as rights_count,
  m.created_at,
  m.name as member_name,
  m.phone as member_phone,
  m.tier as member_tier,
  m.is_registered as member_is_registered,
  case
    when coalesce(lr.is_refunded, false) then 'refunded'
    when coalesce(m.is_registered, false) then 'registered_116'
    when coalesce(m.tier::text, '') ilike '%2차%' then 'second_member'
    when coalesce(m.tier::text, '') ilike '%지주%' then 'landlord_member'
    when coalesce(m.tier::text, '') ilike '%일반%' then 'general_sale'
    else 'reserve_member'
  end as member_segment
from legacy_records lr
left join members m
  on m.id = lr.member_id;

comment on view vw_certificate_segment_base is
'권리증 상세 베이스 뷰. 조합원 상태 6종 분류와 rights_count 포함';

-- -----------------------------------------------------
-- 2) 상태별 집계 뷰
-- -----------------------------------------------------
create or replace view vw_certificate_summary_by_segment as
select
  member_segment,
  case member_segment
    when 'registered_116' then '등기조합원116'
    when 'reserve_member' then '예비조합원'
    when 'second_member' then '2차조합원'
    when 'landlord_member' then '지주조합원'
    when 'general_sale' then '일반분양'
    when 'refunded' then '환불자'
    else member_segment
  end as member_segment_label,
  count(*)::int as owner_count,
  count(*) filter (where rights_count > 0)::int as owner_with_certificate_count,
  coalesce(sum(rights_count), 0)::int as certificate_count
from vw_certificate_segment_base
group by member_segment;

comment on view vw_certificate_summary_by_segment is
'상태 6종별 인원/권리증 수 집계';

-- -----------------------------------------------------
-- 3) 등기조합원116 vs 그외 집계 뷰
-- -----------------------------------------------------
create or replace view vw_certificate_summary_registered_vs_others as
select
  coalesce(sum(case when member_segment = 'registered_116' then rights_count else 0 end), 0)::int
    as registered_116_certificate_count,
  coalesce(sum(case when member_segment <> 'registered_116' then rights_count else 0 end), 0)::int
    as others_certificate_count,
  coalesce(sum(rights_count), 0)::int
    as total_certificate_count,
  coalesce(sum(case when member_segment = 'registered_116' then 1 else 0 end), 0)::int
    as registered_116_owner_count,
  coalesce(sum(case when member_segment <> 'registered_116' then 1 else 0 end), 0)::int
    as others_owner_count
from vw_certificate_segment_base;

comment on view vw_certificate_summary_registered_vs_others is
'등기조합원116과 그외 그룹의 권리증/인원 총계';

-- -----------------------------------------------------
-- 4) 환불자 우선관리 뷰 (권리증 보유자 우선)
-- -----------------------------------------------------
create or replace view vw_refunded_certificate_priority as
select
  legacy_record_id,
  original_name,
  source_file,
  rights_count,
  member_phone,
  created_at
from vw_certificate_segment_base
where member_segment = 'refunded'
  and rights_count > 0
order by rights_count desc, original_name asc;

comment on view vw_refunded_certificate_priority is
'환불자 중 권리증 보유자 우선관리 목록';

-- -----------------------------------------------------
-- 5) 빠른 확인 쿼리 예시
-- -----------------------------------------------------
-- select * from vw_certificate_summary_by_segment
-- order by case member_segment
--   when 'registered_116' then 1
--   when 'reserve_member' then 2
--   when 'second_member' then 3
--   when 'landlord_member' then 4
--   when 'general_sale' then 5
--   when 'refunded' then 6
--   else 99
-- end;
--
-- select * from vw_certificate_summary_registered_vs_others;
--
-- select * from vw_refunded_certificate_priority limit 50;
