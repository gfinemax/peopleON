-- 권리증번호 전용 컬럼 추가 및 기존 데이터 초기 백필

alter table public.asset_rights
    add column if not exists right_number_raw text,
    add column if not exists right_number_status text,
    add column if not exists right_number_note text,
    add column if not exists classification_source text not null default 'legacy',
    add column if not exists classified_at timestamptz,
    add column if not exists classified_by uuid;

alter table public.asset_rights
    alter column right_number drop not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'asset_rights_right_number_status_check'
    ) then
        alter table public.asset_rights
            add constraint asset_rights_right_number_status_check
            check (
                right_number_status is null
                or right_number_status in (
                    'confirmed',
                    'declared_owned',
                    'pending',
                    'missing',
                    'invalid',
                    'review_required'
                )
            );
    end if;
end $$;

update public.asset_rights
set
    right_number_raw = coalesce(nullif(btrim(right_number_raw), ''), nullif(btrim(right_number), '')),
    classification_source = case
        when classification_source is null or classification_source = '' then 'legacy'
        else classification_source
    end
where right_type = 'certificate';
