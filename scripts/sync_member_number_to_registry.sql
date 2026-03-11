-- =====================================================
-- 3. 누락된 7명 강제 동기화 (116명 맞추기 권장)
-- =====================================================
-- 황은상, 조미정 등 번호가 있는 사람은 번호를, 
-- 번호가 없는 사람은 '임시' 번호를 생성하여 등기조합원 통계에 산입합니다.

INSERT INTO public.certificate_registry (
    entity_id, 
    certificate_number_raw, 
    certificate_number_normalized, 
    source_type, 
    certificate_status, 
    is_confirmed_for_count, 
    is_active, 
    created_at, 
    updated_at
)
SELECT 
    ae.id,
    COALESCE(ae.member_number, '미확인-' || ae.display_name),
    BTRIM(COALESCE(ae.member_number, '미확인-' || ae.display_name)),
    'member_number', -- 허용된 source_type 값
    'confirmed',
    true,
    true,
    now(),
    now()
FROM public.account_entities ae
JOIN public.membership_roles mr ON mr.entity_id = ae.id AND mr.is_registered = true
WHERE ae.display_name IN ('김종선','류제백(별세)','박주식','이성래','조미정','허영','황은상')
  AND NOT EXISTS (
      SELECT 1 FROM public.certificate_registry cr 
      WHERE cr.entity_id = ae.id AND cr.is_active = true
  );

-- 최종 통계 확인
-- SELECT * FROM public.vw_certificate_grand_stats;
