import os
from supabase import create_client

SUPABASE_URL = "https://qhmgtqihwvysfrcxelnn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobWd0cWlod3Z5c2ZyY3hlbG5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4NzExNSwiZXhwIjoyMDg0NTYzMTE1fQ.jZHOXepwS4tNoLaJHA4V_v5efisIlPDYmPzxdGXaTbU"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_rights():
    print("📊 권리증 보유 현황 분석 (환불자/과거기록 대상)")
    
    # 1. 환불자(is_refunded=True) 전체 조회
    # 1000명까지 조회 (전체 276명이므로 충분)
    res = supabase.table("legacy_records").select("original_name, rights_count").eq("is_refunded", True).execute()
    
    refunded_records = res.data
    total_refunded = len(refunded_records)
    
    # 2. 권리증 보유자 필터링
    holders = [r for r in refunded_records if r.get("rights_count", 0) > 0]
    total_holders = len(holders)
    
    # 3. 권리증 개수별 통계
    count_stats = {}
    total_certs = 0
    for r in holders:
        cnt = r.get("rights_count", 0)
        total_certs += cnt
        count_stats[cnt] = count_stats.get(cnt, 0) + 1
        
    print(f"\n[분석 결과]")
    print(f"총 과거/환불자 기록: {total_refunded}명")
    print(f"권리증 보유자 수: {total_holders}명 ({(total_holders/total_refunded*100):.1f}%)")
    print(f"보유 권리증 총 개수: {total_certs}개")
    
    print(f"\n[보유 개수별 분포]")
    for cnt in sorted(count_stats.keys()):
        print(f" - {cnt}개 보유: {count_stats[cnt]}명")

    print("\n[샘플 보유자 (상위 5명)]")
    sorted_holders = sorted(holders, key=lambda x: x.get("rights_count", 0), reverse=True)[:5]
    for h in sorted_holders:
        print(f" - {h['original_name']}: {h['rights_count']}개")

if __name__ == "__main__":
    analyze_rights()
