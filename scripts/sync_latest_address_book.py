"""
최신주소(피플용).xlsx 기반 조합원 동기화 스크립트.

목표:
1) NO 1~116 메인 구간을 등기조합원 데이터로 members 테이블에 반영
2) 메인 구간 이후 기타 이름(예비/기타)을 members 테이블에 반영
3) legacy_records.original_name 과 members 매칭을 갱신(member_id, is_refunded)
4) 대리인 정보(relationships) 갱신

기본은 Dry-run이며, 실제 반영은 --apply 옵션 사용.
"""

from __future__ import annotations

import argparse
import os
import re
from dataclasses import dataclass
from typing import Any

import pandas as pd
from supabase import Client, create_client

FILE_PATH = "data/최신주소(피플용).xlsx"
SHEET_NAME = "최신 주소록"

ANNOTATION_WORDS = ("별세", "시동생", "없는사람")
MOBILE_PATTERN = re.compile(r"01[016789][-\s]?\d{3,4}[-\s]?\d{4}")
ZIP_PATTERN = re.compile(r"\b(\d{5})\b")


@dataclass
class MemberRow:
    no: int | None
    raw_name: str
    canonical_name: str
    phone: str
    member_number: str
    address: str
    status: str
    unit_group: str
    memo: str
    proxy_name: str
    proxy_phone: str
    source_section: str
    raw: dict[str, Any]


def load_env_file(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            text = line.strip()
            if not text or "=" not in text:
                continue
            key, value = text.split("=", 1)
            env[key] = value
    return env


def create_supabase() -> Client:
    env_local = load_env_file(".env.local")
    url = os.environ.get("SUPABASE_URL") or env_local.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY") or env_local.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Supabase 연결 정보가 없습니다. (.env.local 또는 SUPABASE_URL/SUPABASE_SERVICE_KEY)")
    return create_client(url, key)


def is_nan_like(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    text = str(value).strip()
    return text == "" or text.lower() == "nan"


def as_text(value: Any) -> str:
    if is_nan_like(value):
        return ""
    return str(value).strip()


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def clean_name_for_display(raw_name: str) -> str:
    text = raw_name.replace("\r", " ").replace("\n", " ")
    text = text.replace("?", "")
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_name_key(text: str) -> str:
    return re.sub(r"\s+", "", text).strip()


def strip_annotations(name: str) -> str:
    text = name.replace("?", "").replace("X", "")
    text = text.replace("\r", " ").replace("\n", " ")
    for word in ANNOTATION_WORDS:
        text = text.replace(word, "")
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_phone(value: str) -> str:
    if not value:
        return ""
    digits = re.sub(r"\D", "", value)
    return digits if len(digits) >= 8 else ""


def extract_proxy_phone(text: str) -> str:
    if not text:
        return ""
    match = MOBILE_PATTERN.search(text)
    if not match:
        return ""
    return normalize_phone(match.group(0))


def parse_member_number(value: Any) -> str:
    if is_nan_like(value):
        return ""

    if isinstance(value, pd.Timestamp):
        return f"{value.year}-{value.month}-{value.day}"

    text = str(value).strip()
    if not text:
        return ""

    date_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})\s+00:00:00$", text)
    if date_match:
        y, m, d = date_match.groups()
        return f"{int(y)}-{int(m)}-{int(d)}"

    return text


def infer_status(row: dict[str, Any], raw_name: str, fallback: str) -> str:
    if "별세" in raw_name:
        return "사망"
    if as_text(row.get("소송")):
        return "소송중"
    if as_text(row.get("탈퇴")):
        return "탈퇴예정"
    change_text = as_text(row.get("변경신청"))
    if "탈퇴" in change_text:
        return "탈퇴예정"
    return fallback or "정상"


def build_memo(row: dict[str, Any], source_section: str, existing_memo: str) -> str:
    notes: list[str] = []
    for col in ("대리인 연락처 및 기타", "변경신청", "기타", "25_정기총회", "27일 총회", "설문조사", "모임"):
        value = as_text(row.get(col))
        if value:
            notes.append(f"{col}: {value}")

    if not notes:
        return existing_memo

    block = f"[최신주소 동기화/{source_section}] " + " / ".join(notes)
    if not existing_memo:
        return block
    if block in existing_memo:
        return existing_memo
    return f"{existing_memo}\n{block}"


def extract_zipcode(address: str) -> str:
    if not address:
        return ""
    match = ZIP_PATTERN.search(address)
    return match.group(1) if match else ""


def build_name_candidates(raw_name: str) -> list[str]:
    # 후보 순서가 중요: 앞쪽 후보를 우선 매칭
    candidates: list[str] = []

    def add(value: str) -> None:
        text = normalize_spaces(value)
        if text and text not in candidates:
            candidates.append(text)

    base = clean_name_for_display(raw_name)
    add(base)

    stripped = strip_annotations(base)
    add(stripped)

    no_paren = re.sub(r"\([^)]*\)", " ", stripped)
    add(no_paren)

    # 줄바꿈 분리 후보 (ex. 우승용X\n(없는사람)\n안현숙)
    for part in re.split(r"[\r\n/]+", raw_name):
        chunk = strip_annotations(part)
        if chunk:
            add(chunk)

    # 괄호 내부 이름 후보 (ex. 신금수(신재빈))
    for inside in re.findall(r"\(([^)]*)\)", raw_name):
        inside_clean = strip_annotations(inside)
        if re.fullmatch(r"[가-힣]{2,6}", inside_clean):
            add(inside_clean)

    return candidates


def read_excel_rows() -> tuple[list[MemberRow], list[MemberRow]]:
    df = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME, header=1)

    no_numeric = pd.to_numeric(df["NO"], errors="coerce")
    idx_116_candidates = df.index[no_numeric == 116]
    if len(idx_116_candidates) == 0:
        raise RuntimeError("엑셀에서 NO=116 행을 찾지 못했습니다.")
    idx_116 = int(idx_116_candidates[0])

    main_rows: list[MemberRow] = []
    extra_rows: list[MemberRow] = []

    for idx, raw_row in df.iterrows():
        row = raw_row.to_dict()
        raw_name = as_text(row.get("조합원"))
        if not raw_name or raw_name == "조합원":
            continue
        if as_text(row.get("NO")) == "번호":
            continue

        no_value = pd.to_numeric(row.get("NO"), errors="coerce")
        no_int = int(no_value) if pd.notna(no_value) else None
        if idx <= idx_116 and no_int is not None:
            source_section = "registered_116"
        elif idx > idx_116 and no_int is None:
            source_section = "others"
        else:
            source_section = "supplement"

        phone_primary = normalize_phone(as_text(row.get("핸드폰번호")))
        phone_secondary = normalize_phone(as_text(row.get("핸드폰번호.1")))
        phone = phone_primary or phone_secondary or "미입력"

        canonical_name = clean_name_for_display(raw_name)
        if source_section == "others":
            canonical_name = strip_annotations(canonical_name)

        member_number = parse_member_number(row.get("조합번호"))
        address = normalize_spaces(as_text(row.get("주소")))
        proxy_name = strip_annotations(as_text(row.get("대리인")))
        proxy_detail = as_text(row.get("대리인 연락처 및 기타"))
        proxy_phone = extract_proxy_phone(proxy_detail)

        data = MemberRow(
            no=no_int,
            raw_name=raw_name,
            canonical_name=canonical_name,
            phone=phone,
            member_number=member_number,
            address=address,
            status="정상",
            unit_group=as_text(row.get("입주평형")),
            memo="",
            proxy_name=proxy_name,
            proxy_phone=proxy_phone,
            source_section=source_section,
            raw=row,
        )

        if source_section == "registered_116":
            main_rows.append(data)
        elif source_section == "others":
            # 보조 섹션에서 이름만 있는 행은 기타/예비 후보로 반영
            if canonical_name:
                extra_rows.append(data)

    if len(main_rows) != 116:
        raise RuntimeError(f"등기조합원 메인 구간 행 수가 116이 아닙니다: {len(main_rows)}")

    return main_rows, extra_rows


def build_member_indexes(members: list[dict[str, Any]]) -> dict[str, Any]:
    by_exact: dict[str, list[dict[str, Any]]] = {}
    by_simple: dict[str, list[dict[str, Any]]] = {}
    by_phone: dict[str, list[dict[str, Any]]] = {}
    by_member_number: dict[str, list[dict[str, Any]]] = {}

    for member in members:
        name = as_text(member.get("name"))
        exact_key = normalize_name_key(name)
        simple_key = normalize_name_key(strip_annotations(name))
        phone_key = normalize_phone(as_text(member.get("phone")))
        number_key = parse_member_number(member.get("member_number"))

        if exact_key:
            by_exact.setdefault(exact_key, []).append(member)
        if simple_key:
            by_simple.setdefault(simple_key, []).append(member)
        if phone_key:
            by_phone.setdefault(phone_key, []).append(member)
        if number_key:
            by_member_number.setdefault(number_key, []).append(member)

    return {
        "by_exact": by_exact,
        "by_simple": by_simple,
        "by_phone": by_phone,
        "by_member_number": by_member_number,
    }


def pick_unassigned(candidates: list[dict[str, Any]], assigned_ids: set[str]) -> dict[str, Any] | None:
    available = [m for m in candidates if m.get("id") not in assigned_ids]
    if len(available) == 1:
        return available[0]
    if len(available) == 0 and len(candidates) == 1:
        return candidates[0]
    return None


def match_main_row_to_member(
    row: MemberRow,
    indexes: dict[str, Any],
    assigned_ids: set[str],
) -> tuple[dict[str, Any] | None, str]:
    by_exact = indexes["by_exact"]
    by_simple = indexes["by_simple"]
    by_phone = indexes["by_phone"]
    by_member_number = indexes["by_member_number"]

    candidates = build_name_candidates(row.raw_name)

    for candidate in candidates:
        exact_key = normalize_name_key(candidate)
        matched = pick_unassigned(by_exact.get(exact_key, []), assigned_ids)
        if matched:
            return matched, f"name_exact:{candidate}"

    for candidate in candidates:
        simple_key = normalize_name_key(strip_annotations(candidate))
        matched = pick_unassigned(by_simple.get(simple_key, []), assigned_ids)
        if matched:
            return matched, f"name_simple:{candidate}"

    if row.phone and row.phone != "미입력":
        matched = pick_unassigned(by_phone.get(normalize_phone(row.phone), []), assigned_ids)
        if matched:
            return matched, "phone"

    if row.member_number:
        matched = pick_unassigned(by_member_number.get(row.member_number, []), assigned_ids)
        if matched:
            return matched, "member_number"

    return None, "unmatched"


def upsert_relationship(
    supabase: Client,
    existing_rel_map: dict[tuple[str, str], dict[str, Any]],
    member_id: str,
    member_name: str,
    proxy_name: str,
    proxy_phone: str,
    dry_run: bool,
) -> str:
    if not proxy_name:
        return "skip_empty"
    if normalize_name_key(strip_annotations(proxy_name)) == normalize_name_key(strip_annotations(member_name)):
        return "skip_same_name"

    key = (member_id, normalize_name_key(proxy_name))
    existing = existing_rel_map.get(key)
    payload = {
        "member_id": member_id,
        "name": proxy_name,
        "phone": proxy_phone or "미입력",
        "relation": existing.get("relation") if existing else "",
        "note": "최신주소(피플용) 동기화",
    }

    if dry_run:
        return "dry_run_update" if existing else "dry_run_insert"

    if existing:
        supabase.table("relationships").update(payload).eq("id", existing["id"]).execute()
        return "updated"

    result = supabase.table("relationships").insert(payload).execute()
    if result.data:
        existing_rel_map[key] = result.data[0]
    return "inserted"


def main() -> None:
    parser = argparse.ArgumentParser(description="최신주소(피플용).xlsx 동기화")
    parser.add_argument("--apply", action="store_true", help="실제 DB 반영")
    args = parser.parse_args()
    dry_run = not args.apply

    main_rows, extra_rows = read_excel_rows()
    supabase = create_supabase()

    members_res = supabase.table("members").select("*").execute()
    members = members_res.data or []

    rel_res = supabase.table("relationships").select("id, member_id, name, phone, relation, note").execute()
    relationships = rel_res.data or []
    rel_map: dict[tuple[str, str], dict[str, Any]] = {}
    for rel in relationships:
        rel_key = (rel["member_id"], normalize_name_key(as_text(rel.get("name"))))
        rel_map[rel_key] = rel

    indexes = build_member_indexes(members)
    assigned_member_ids: set[str] = set()

    stats: dict[str, int] = {
        "registered_rows": len(main_rows),
        "registered_matched": 0,
        "registered_unmatched": 0,
        "members_updated": 0,
        "members_inserted": 0,
        "relationships_updated": 0,
        "relationships_inserted": 0,
        "extras_processed": 0,
        "legacy_linked": 0,
        "legacy_conflict_skipped": 0,
    }
    unmatched_main: list[tuple[int | None, str]] = []
    match_details: list[tuple[int | None, str, str, str]] = []

    # 1) 116명 메인 구간 업데이트
    for row in main_rows:
        member, matched_by = match_main_row_to_member(row, indexes, assigned_member_ids)
        if not member:
            stats["registered_unmatched"] += 1
            unmatched_main.append((row.no, row.raw_name))
            continue

        assigned_member_ids.add(member["id"])
        stats["registered_matched"] += 1
        match_details.append((row.no, row.raw_name, as_text(member.get("name")), matched_by))

        fallback_status = as_text(member.get("status")) or "정상"
        status = infer_status(row.raw, row.raw_name, fallback_status)
        memo = build_memo(row.raw, row.source_section, as_text(member.get("memo")))

        payload: dict[str, Any] = {
            "phone": row.phone or as_text(member.get("phone")) or "미입력",
            "member_number": row.member_number or as_text(member.get("member_number")),
            "tier": as_text(member.get("tier")) or "1차",
            "is_registered": True,
            "status": status,
            "memo": memo,
            "unit_group": row.unit_group or as_text(member.get("unit_group")),
        }

        if row.address:
            payload["address_legal"] = row.address
            payload["address_mailing"] = row.address
            zipcode = extract_zipcode(row.address)
            if zipcode:
                payload["zipcode"] = zipcode

        if dry_run:
            stats["members_updated"] += 1
        else:
            supabase.table("members").update(payload).eq("id", member["id"]).execute()
            stats["members_updated"] += 1

        if row.proxy_name:
            rel_result = upsert_relationship(
                supabase=supabase,
                existing_rel_map=rel_map,
                member_id=member["id"],
                member_name=as_text(member.get("name")),
                proxy_name=row.proxy_name,
                proxy_phone=row.proxy_phone,
                dry_run=dry_run,
            )
            if rel_result in ("updated", "dry_run_update"):
                stats["relationships_updated"] += 1
            if rel_result in ("inserted", "dry_run_insert"):
                stats["relationships_inserted"] += 1

    # 2) 기타/예비 이름 반영 (메인 섹션 외)
    # 중복 이름은 첫 값 우선
    seen_extra_names: set[str] = set()
    for row in extra_rows:
        name_key = normalize_name_key(row.canonical_name)
        if not name_key or name_key in seen_extra_names:
            continue
        seen_extra_names.add(name_key)
        stats["extras_processed"] += 1

        # 기존 멤버 조회 (exact -> simple)
        exact_matches = indexes["by_exact"].get(name_key, [])
        simple_matches = indexes["by_simple"].get(normalize_name_key(strip_annotations(row.canonical_name)), [])
        target_member = exact_matches[0] if len(exact_matches) == 1 else (simple_matches[0] if len(simple_matches) == 1 else None)

        if target_member:
            fallback_status = as_text(target_member.get("status")) or "정상"
            status = infer_status(row.raw, row.raw_name, fallback_status)
            memo = build_memo(row.raw, row.source_section, as_text(target_member.get("memo")))
            payload: dict[str, Any] = {
                "phone": row.phone or as_text(target_member.get("phone")) or "미입력",
                "tier": as_text(target_member.get("tier")) or "예비",
                "status": status,
                "is_registered": bool(target_member.get("is_registered")),
                "memo": memo,
            }
            if not target_member.get("is_registered"):
                payload["tier"] = "예비"
            if row.address:
                payload["address_legal"] = row.address
                payload["address_mailing"] = row.address
                zipcode = extract_zipcode(row.address)
                if zipcode:
                    payload["zipcode"] = zipcode

            if dry_run:
                stats["members_updated"] += 1
            else:
                supabase.table("members").update(payload).eq("id", target_member["id"]).execute()
                stats["members_updated"] += 1
        else:
            # 신규 생성: 예비/기타
            status = infer_status(row.raw, row.raw_name, "정상")
            payload = {
                "name": row.canonical_name,
                "phone": row.phone or "미입력",
                "member_number": row.member_number,
                "tier": "예비",
                "is_registered": False,
                "status": status,
                "memo": build_memo(row.raw, row.source_section, ""),
                "unit_group": row.unit_group,
                "address_legal": row.address,
                "address_mailing": row.address,
            }
            zipcode = extract_zipcode(row.address)
            if zipcode:
                payload["zipcode"] = zipcode

            if dry_run:
                stats["members_inserted"] += 1
            else:
                inserted = supabase.table("members").insert(payload).execute()
                if inserted.data:
                    members.append(inserted.data[0])
                stats["members_inserted"] += 1

    # 3) legacy_records 이름 매칭 갱신
    # members 최신 다시 로드
    members = (supabase.table("members").select("id, name").execute().data or []) if not dry_run else members

    name_to_member_ids: dict[str, set[str]] = {}
    for member in members:
        keys = {
            normalize_name_key(as_text(member.get("name"))),
            normalize_name_key(strip_annotations(as_text(member.get("name")))),
        }
        for key in keys:
            if key:
                name_to_member_ids.setdefault(key, set()).add(member["id"])

    # 엑셀 이름 후보 -> 실제 매핑된 member_id도 추가
    row_to_member: dict[str, str] = {}
    for no, raw_name, mapped_name, _ in match_details:
        _ = no
        key = normalize_name_key(clean_name_for_display(raw_name))
        # mapped_name 기준으로 멤버 id 찾기
        member_ids = [
            m["id"]
            for m in members
            if normalize_name_key(as_text(m.get("name"))) == normalize_name_key(mapped_name)
        ]
        if len(member_ids) == 1:
            row_to_member[key] = member_ids[0]

    legacy_records = supabase.table("legacy_records").select("id, original_name, member_id").execute().data or []
    for record in legacy_records:
        original_name = as_text(record.get("original_name"))
        keys = {
            normalize_name_key(original_name),
            normalize_name_key(strip_annotations(original_name)),
        }

        candidate_ids: set[str] = set()
        for key in keys:
            if not key:
                continue
            candidate_ids.update(name_to_member_ids.get(key, set()))
            mapped = row_to_member.get(key)
            if mapped:
                candidate_ids.add(mapped)

        if len(candidate_ids) != 1:
            continue

        target_member_id = next(iter(candidate_ids))
        current_member_id = record.get("member_id")
        if current_member_id and current_member_id != target_member_id:
            stats["legacy_conflict_skipped"] += 1
            continue
        if current_member_id == target_member_id:
            continue

        if dry_run:
            stats["legacy_linked"] += 1
        else:
            supabase.table("legacy_records").update(
                {"member_id": target_member_id, "is_refunded": False}
            ).eq("id", record["id"]).execute()
            stats["legacy_linked"] += 1

    mode = "DRY-RUN" if dry_run else "APPLY"
    print(f"\n=== 최신주소 동기화 결과 ({mode}) ===")
    for key, value in stats.items():
        print(f"{key}: {value}")

    if unmatched_main:
        print("\n[경고] 116명 구간에서 매칭되지 않은 행")
        for no, name in unmatched_main:
            print(f"- NO {no}: {name}")

    print("\n[참고] 메인 구간 매칭 샘플 15건")
    for item in match_details[:15]:
        no, excel_name, mapped_name, matched_by = item
        print(f"- NO {no}: '{excel_name}' -> '{mapped_name}' ({matched_by})")


if __name__ == "__main__":
    main()
