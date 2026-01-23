-- 1. Members 테이블 확장 (AI 태깅 기능 추가)
ALTER TABLE members ADD COLUMN IF NOT EXISTS tags text[];

-- 2. CRM 로그 테이블 생성
CREATE TABLE IF NOT EXISTS interaction_logs (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references members(id),
  type text, -- CALL, MEET, SMS, DOC
  summary text,
  direction text, -- Inbound, Outbound
  staff_name text,
  attachment text,
  created_at timestamptz default now()
);

-- 3. 표준 가격표 테이블 생성
CREATE TABLE IF NOT EXISTS price_tables (
  id uuid default gen_random_uuid() primary key,
  tier text, -- 1차, 지주...
  unit text, -- 59, 84...
  step integer, -- 1, 2...
  step_name text,
  amount numeric,
  due_date date
);

-- 4. 개인별 납부원장 테이블 생성
CREATE TABLE IF NOT EXISTS payments (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references members(id),
  step integer,
  amount_due numeric default 0,
  amount_paid numeric default 0,
  paid_date date,
  is_paid boolean default false,
  created_at timestamptz default now()
);
