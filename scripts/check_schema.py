import os
from supabase import create_client

SUPABASE_URL = "https://qhmgtqihwvysfrcxelnn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobWd0cWlod3Z5c2ZyY3hlbG5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4NzExNSwiZXhwIjoyMDg0NTYzMTE1fQ.jZHOXepwS4tNoLaJHA4V_v5efisIlPDYmPzxdGXaTbU"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    # legacy_records 테이블의 컬럼 정보 조회하는 RPC가 없으므로, 
    # 간단하게 Select * limit 1 해서 반환되는 키를 확인하거나
    # 에러 메시지를 통해 유추해야 함.
    # 하지만 가장 좋은 건 information_schema 조회인데, Supabase-py 클라이언트로는 
    # 직접 SQL 실행이 불가능할 수 있음 (Service Role Key라면 가능할수도 있지만 보통은 안됨)
    # 따라서, RPC function을 호출하거나, REST API로 조회해야 함.
    
    # 여기서는 데이터 1개를 조회해서 필드를 확인해본다.
    res = supabase.table("legacy_records").select("*").limit(1).execute()
    if res.data:
        print("Existing columns:", res.data[0].keys())
    else:
        # 데이터가 없으면 insert 시도해서 에러 메시지 확인
        print("No data found. Trying dummy insert to check columns...")
        try:
            supabase.table("legacy_records").insert({
                "legacy_name": "StructureCheck",
                "is_refunded": True,
                "raw_data": {},
                "contacts": [],
                "rights_count": 0
            }).execute()
            print("Insert SUCCESS. Columns exist.")
            # 롤백 (삭제)
            supabase.table("legacy_records").delete().eq("legacy_name", "StructureCheck").execute()
        except Exception as e:
            print(f"Insert FAILED. Missing columns? Error: {e}")

except Exception as e:
    print(f"Connection Error: {e}")
