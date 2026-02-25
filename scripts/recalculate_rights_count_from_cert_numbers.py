import argparse
import os
import re
from typing import Any

from supabase import create_client

CERT_NO_PATTERNS = [
    re.compile(r"^\d{4}-\d{1,2}-\d+$"),
    re.compile(r"^\d{4}\.\d{1,2}\.\d+$"),
    re.compile(r"^\d{4}/\d{1,2}/\d+$"),
    re.compile(r"^\d{4}[-./]특[-./]?\d+$"),
]
SPECIAL_CERT_PATTERN = re.compile(r"^(\d{4})-특-?(\d+)$")

CERT_KEYWORDS = [
    "필증",
    "권리증",
    "증서",
    "증번호",
    "채권번호",
    "certificate",
    "cert_no",
    "certno",
]


def normalize_cert_no(value: Any) -> str | None:
    if value is None:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    lowered = raw.lower()
    if lowered in {"nan", "none", "null", "-", "없음"}:
        return None

    compact = re.sub(r"\s+", "", raw)
    compact = compact.replace(".", "-").replace("/", "-")
    special_match = SPECIAL_CERT_PATTERN.fullmatch(compact)
    if special_match:
        return f"{special_match.group(1)}-특-{special_match.group(2)}"

    for pattern in CERT_NO_PATTERNS:
        if pattern.match(compact):
            return compact
    return None


def is_cert_key(key: str) -> bool:
    lowered = key.lower()
    return any(keyword in lowered for keyword in CERT_KEYWORDS)


def collect_from_unknown(node: Any, cert_set: set[str], parent_key: str = "") -> None:
    if node is None:
        return

    if isinstance(node, list):
        for item in node:
            collect_from_unknown(item, cert_set, parent_key)
        return

    if isinstance(node, dict):
        for key, value in node.items():
            if is_cert_key(key) or is_cert_key(parent_key):
                normalized = normalize_cert_no(value)
                if normalized:
                    cert_set.add(normalized)
            collect_from_unknown(value, cert_set, key)
        return

    if is_cert_key(parent_key):
        normalized = normalize_cert_no(node)
        if normalized:
            cert_set.add(normalized)


def collect_from_certificates(certificates: Any, cert_set: set[str]) -> None:
    if not isinstance(certificates, list):
        return

    for certificate in certificates:
        if not isinstance(certificate, dict):
            continue
        for key, value in certificate.items():
            if key in {"no", "number"} or is_cert_key(str(key)):
                normalized = normalize_cert_no(value)
                if normalized:
                    cert_set.add(normalized)


def extract_certificate_numbers(raw_data: Any, certificates: Any) -> list[str]:
    cert_set: set[str] = set()
    collect_from_certificates(certificates, cert_set)
    collect_from_unknown(raw_data, cert_set)
    return sorted(cert_set)


def fetch_all_legacy_records(supabase_client: Any) -> list[dict[str, Any]]:
    all_records: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0

    while True:
        res = (
            supabase_client.table("legacy_records")
            .select("id, original_name, rights_count, raw_data, certificates")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break

        all_records.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return all_records


def main() -> None:
    parser = argparse.ArgumentParser(
        description="권리증 번호를 기준으로 legacy_records.rights_count 재계산"
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="실제 업데이트 실행 (기본은 dry-run)",
    )
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수가 필요합니다.")

    supabase = create_client(supabase_url, supabase_key)
    records = fetch_all_legacy_records(supabase)

    print(f"총 대상: {len(records)}건")

    changed: list[dict[str, Any]] = []
    for record in records:
        cert_numbers = extract_certificate_numbers(
            record.get("raw_data"),
            record.get("certificates"),
        )
        new_count = len(cert_numbers)
        old_count = int(record.get("rights_count") or 0)
        if new_count != old_count:
            changed.append(
                {
                    "id": record["id"],
                    "name": record.get("original_name", ""),
                    "old_count": old_count,
                    "new_count": new_count,
                    "numbers": cert_numbers,
                }
            )

    print(f"변경 필요: {len(changed)}건")
    for row in changed[:20]:
        print(
            f"- {row['name']}: {row['old_count']} -> {row['new_count']} | "
            f"{', '.join(row['numbers'][:3]) if row['numbers'] else '번호없음'}"
        )

    if not args.run:
        print("dry-run 완료. 실제 반영하려면 --run 옵션을 사용하세요.")
        return

    success = 0
    failed = 0
    for row in changed:
        try:
            (
                supabase.table("legacy_records")
                .update({"rights_count": row["new_count"]})
                .eq("id", row["id"])
                .execute()
            )
            success += 1
        except Exception as e:
            failed += 1
            print(f"[실패] {row['name']} ({row['id']}): {e}")

    print(f"업데이트 완료: 성공 {success}건 / 실패 {failed}건")


if __name__ == "__main__":
    main()
