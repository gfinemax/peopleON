import os
import pandas as pd
import json
from supabase import create_client

SUPABASE_URL = "https://qhmgtqihwvysfrcxelnn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobWd0cWlod3Z5c2ZyY3hlbG5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4NzExNSwiZXhwIjoyMDg0NTYzMTE1fQ.jZHOXepwS4tNoLaJHA4V_v5efisIlPDYmPzxdGXaTbU"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def export_to_excel():
    print("📥 데이터 조회 중...")
    
    # 1. 환불자 중 권리증 보유자 조회
    res = supabase.table("legacy_records") \
        .select("*") \
        .eq("is_refunded", True) \
        .gt("rights_count", 0) \
        .order("rights_count", desc=True) \
        .execute()
    
    records = res.data
    print(f"✅ 총 {len(records)}명 조회됨")
    
    # 2. 데이터 가공
    export_list = []
    for r in records:
        # JSONB 필드 문자열 변환
        contacts = r.get("contacts") or []
        contact_str = ", ".join([str(c) for c in contacts]) if isinstance(contacts, list) else str(contacts)
        
        addresses = r.get("addresses") or []
        addr_str = " | ".join([str(a) for a in addresses]) if isinstance(addresses, list) else str(addresses)
        
        certs = r.get("certificates") or []
        cert_details = ""
        if isinstance(certs, list):
            cert_details = "\n".join([f"[{c.get('no', '')}] {c.get('price', '')}" for c in certs])
            
        export_list.append({
            "성명": r.get("original_name"),
            "권리증수": r.get("rights_count"),
            "생년월일": r.get("birth_date"),
            "연락처": contact_str,
            "주소": addr_str,
            "필증상세": cert_details,
            "비고": r.get("memo")
        })
        
    # 3. 엑셀 저장
    df = pd.DataFrame(export_list)
    output_filename = "data/권리증보유_환불자명단.xlsx"
    
    # 디렉토리 확인
    os.makedirs("data", exist_ok=True)
    
    df.to_excel(output_filename, index=False)
    print(f"🎉 파일 생성 완료: {output_filename}")

if __name__ == "__main__":
    export_to_excel()
