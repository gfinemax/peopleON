-- 마이그레이션: status 컬럼 추가 및 기존 데이터 복원 --

-- 1. account_entities 에 status 컬럼 추가 (기본값 '정상')
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS status text DEFAULT '정상';

-- 2. memo 에 '소송' 키워드가 있는 경우 '제명'으로 변경
UPDATE account_entities 
SET status = '제명' 
WHERE memo LIKE '%소송%';

-- 3. role 이 inactive 인데 status가 정상이면 '탈퇴' 로 간주 (일부만 적용)
UPDATE account_entities e
SET status = '탈퇴'
FROM membership_roles r
WHERE e.id = r.entity_id 
  AND r.role_status = 'inactive'
  AND e.status = '정상';
