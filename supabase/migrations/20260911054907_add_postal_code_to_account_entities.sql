alter table public.account_entities
    add column if not exists postal_code text;

comment on column public.account_entities.postal_code is
    '우편물 발송에 사용하는 우편번호';
