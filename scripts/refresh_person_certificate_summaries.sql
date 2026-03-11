-- person_certificate_summaries 의 provisional/conflict 값을
-- 최신 certificate_registry 기준으로 다시 동기화합니다.
-- manual_certificate_count / review_status / summary_note 는 유지합니다.

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
