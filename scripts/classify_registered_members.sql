-- 등기조합원 116명 분류 및 식별 플래그 업데이트

DO $$
DECLARE
    row_count INT;
BEGIN
    -- 1. membership_roles 테이블의 is_registered 플래그 업데이트
    UPDATE public.membership_roles
    SET is_registered = TRUE
    WHERE role_code = '등기조합원';
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % roles to is_registered = TRUE', row_count;

    -- 2. account_entities 테이블의 tags 컬럼 보강 ('등기' 태그 추가)
    -- array_append를 사용하여 기존 태그가 있으면 유지하고 없으면 생성
    UPDATE public.account_entities
    SET tags = CASE 
        WHEN tags IS NULL THEN ARRAY['등기'::text]
        WHEN NOT ('등기' = ANY(tags)) THEN array_append(tags, '등기'::text)
        ELSE tags
    END
    WHERE id IN (
        SELECT entity_id 
        FROM public.membership_roles 
        WHERE role_code = '등기조합원'
    );

    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated symbols/tags for % account entities', row_count;
END $$;

-- 최종 확인 쿼리
SELECT role_code, count(*), bool_and(is_registered) as all_marked
FROM public.membership_roles
WHERE role_code = '등기조합원'
GROUP BY role_code;
