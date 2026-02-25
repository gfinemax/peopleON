"""
members.member_number(조합번호)를 legacy_records 권리증번호에 반영.

동작:
1) legacy_records.member_id 로 members를 찾거나
2) original_name 과 members.name을 정규화 매칭(유일 매칭만)
3) member_number가 권리증 패턴(YYYY-M-N)을 만족하면
   - certificates 배열에 no 추가
   - raw_data["권리증번호_조합번호"] 기록

기본은 Dry-run, 실제 반영은 --apply.
"""

from __future__ import annotations

import argparse
import os
import re
from typing import Any

from supabase import Client, create_client

CERT_PATTERNS = [
    re.compile(r"^\d{4}-\d{1,2}-\d+$"),
    re.compile(r"^\d{4}[-./]특[-./]?\d+$"),
]
SPECIAL_CERT_PATTERN = re.compile(r"^(\d{4})-특-?(\d+)$")
CERT_LIKE_KEYWORDS = ("권리증", "필증", "증서", "증번호", "채권번호", "certificate", "cert_no", "certno")
ANNOTATION_WORDS = ("별세", "시동생", "없는사람")


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
        raise RuntimeError("Supabase 연결 정보가 없습니다.")
    return create_client(url, key)


def as_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return text


def normalize_name_key(name: str) -> str:
    text = as_text(name).replace("?", "").replace("X", "")
    for word in ANNOTATION_WORDS:
        text = text.replace(word, "")
    text = text.replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"\(\s*\)", "", text)
    return text.strip()


def is_certificate_like_key(key: str) -> bool:
    lower = key.lower()
    return any(k.lower() in lower for k in CERT_LIKE_KEYWORDS)


def normalize_cert_value(value: Any) -> str | None:
    raw = as_text(value)
    if not raw:
        return None
    compact = re.sub(r"\s+", "", raw)
    compact = compact.replace(".", "-").replace("/", "-")
    special_match = SPECIAL_CERT_PATTERN.fullmatch(compact)
    if special_match:
        return f"{special_match.group(1)}-특-{special_match.group(2)}"
    for pattern in CERT_PATTERNS:
        if pattern.fullmatch(compact):
            return compact
    return None


def collect_cert_numbers(raw_data: Any, certificates: Any) -> set[str]:
    found: set[str] = set()

    def walk(node: Any, parent_key: str = "") -> None:
        if node is None:
            return
        if isinstance(node, list):
            for item in node:
                walk(item, parent_key)
            return
        if isinstance(node, dict):
            for key, value in node.items():
                if is_certificate_like_key(str(key)) or is_certificate_like_key(parent_key):
                    normalized = normalize_cert_value(value)
                    if normalized:
                        found.add(normalized)
                walk(value, str(key))
            return
        if is_certificate_like_key(parent_key):
            normalized = normalize_cert_value(node)
            if normalized:
                found.add(normalized)

    if isinstance(certificates, list):
        for cert in certificates:
            if not isinstance(cert, dict):
                continue
            for key, value in cert.items():
                key_text = str(key).lower()
                if key_text not in ("no", "number") and not is_certificate_like_key(str(key)):
                    continue
                normalized = normalize_cert_value(value)
                if normalized:
                    found.add(normalized)

    walk(raw_data)
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description="조합번호 -> 권리증번호 반영")
    parser.add_argument("--apply", action="store_true", help="실제 반영")
    args = parser.parse_args()
    dry_run = not args.apply

    supabase = create_supabase()
    members = supabase.table("members").select("id,name,member_number").execute().data or []
    legacy_records = supabase.table("legacy_records").select(
        "id,original_name,member_id,raw_data,certificates"
    ).execute().data or []

    member_by_id = {m["id"]: m for m in members}
    name_index: dict[str, list[dict[str, Any]]] = {}
    for member in members:
        key = normalize_name_key(as_text(member.get("name")))
        if not key:
            continue
        name_index.setdefault(key, []).append(member)

    stats = {
        "total_legacy": len(legacy_records),
        "target_rows": 0,
        "updated_rows": 0,
        "skipped_no_member_number": 0,
        "skipped_invalid_member_number_format": 0,
        "skipped_already_exists": 0,
        "skipped_ambiguous_name": 0,
    }

    sample_updates: list[tuple[str, str, str]] = []

    for record in legacy_records:
        member = None
        if record.get("member_id") and record["member_id"] in member_by_id:
            member = member_by_id[record["member_id"]]
        else:
            key = normalize_name_key(as_text(record.get("original_name")))
            candidates = name_index.get(key, [])
            if len(candidates) == 1:
                member = candidates[0]
            elif len(candidates) > 1:
                stats["skipped_ambiguous_name"] += 1
                continue
            else:
                continue

        member_number = as_text(member.get("member_number"))
        if not member_number:
            stats["skipped_no_member_number"] += 1
            continue
        normalized_member_number = normalize_cert_value(member_number)
        if not normalized_member_number:
            stats["skipped_invalid_member_number_format"] += 1
            continue

        stats["target_rows"] += 1

        current_certs = collect_cert_numbers(record.get("raw_data"), record.get("certificates"))
        if normalized_member_number in current_certs:
            stats["skipped_already_exists"] += 1
            continue

        raw_data = record.get("raw_data")
        if not isinstance(raw_data, dict):
            raw_data = {}
        raw_data["권리증번호_조합번호"] = normalized_member_number

        certificates = record.get("certificates")
        if not isinstance(certificates, list):
            certificates = []

        certificates.append(
            {
                "no": normalized_member_number,
                "source": "members.member_number_sync",
            }
        )

        if not dry_run:
            supabase.table("legacy_records").update(
                {
                    "raw_data": raw_data,
                    "certificates": certificates,
                }
            ).eq("id", record["id"]).execute()

        stats["updated_rows"] += 1
        if len(sample_updates) < 20:
            sample_updates.append(
                (
                    as_text(record.get("original_name")),
                    as_text(member.get("name")),
                    normalized_member_number,
                )
            )

    mode = "DRY-RUN" if dry_run else "APPLY"
    print(f"\n=== 조합번호 -> 권리증번호 동기화 ({mode}) ===")
    for key, value in stats.items():
        print(f"{key}: {value}")

    if sample_updates:
        print("\n샘플 업데이트:")
        for legacy_name, member_name, number in sample_updates:
            print(f"- legacy '{legacy_name}' -> member '{member_name}' / {number}")


if __name__ == "__main__":
    main()
