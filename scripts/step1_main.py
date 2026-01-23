import pandas as pd
from supabase import create_client, Client

# ==========================================
# 👇 본인의 Supabase 정보로 바꿔주세요
# ==========================================
SUPABASE_URL = "https://qhmgtqihwvysfrcxelnn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobWd0cWlod3Z5c2ZyY3hlbG5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4NzExNSwiZXhwIjoyMDg0NTYzMTE1fQ.jZHOXepwS4tNoLaJHA4V_v5efisIlPDYmPzxdGXaTbU" 

# Supabase 연결
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ 연결 실패: {e}")
    exit()

def clean_phone(phone):
    """전화번호 정제: 없으면 '미입력' 처리"""
    if pd.isna(phone): return "미입력"
    cleaned = str(phone).strip().replace("-", "").replace(" ", "").replace("\n", "")
    if cleaned == "": return "미입력"
    return cleaned

def clean_name(name):
    """이름 정제"""
    if pd.isna(name): return "이름미상"
    return str(name).strip()

print("🚀 [Step 1-최종] 116명 전원(누락 없음) 등록 시작...")

# 1. 엑셀 파일 읽기 (진단 결과에 따라 header=1로 고정!)
try:
    # header=1 : 두 번째 줄을 제목으로 읽습니다.
    df = pd.read_excel("data/current.xlsx", header=1)
    print(f"📂 엑셀 로드 성공: 총 {len(df)}행")
except Exception as e:
    print(f"❌ 엑셀 파일 읽기 실패: {e}")
    exit()

success_count = 0
updated_count = 0

for idx, row in df.iterrows():
    raw_name = row.get('조합원')
    raw_phone = row.get('핸드폰번호')
    
    # [핵심] 이름이 없으면 스킵하지만, 전화번호는 없어도 진행합니다!
    if pd.isna(raw_name) or str(raw_name) == '조합원':
        continue
        
    name = clean_name(raw_name)
    phone = clean_phone(raw_phone) # 전화번호 없으면 '미입력'
    
    member_num = str(row.get('조합번호', ''))
    if member_num == 'nan': member_num = ''
    address = str(row.get('주소', ''))

    # 상태/비고 통합
    memo_list = []
    if pd.notna(row.get('비고')): memo_list.append(str(row.get('비고')))
    if pd.notna(row.get('기타')): memo_list.append(str(row.get('기타')))
    if pd.notna(row.get('탈퇴')): memo_list.append(f"탈퇴관련: {str(row.get('탈퇴'))}")
    if pd.notna(row.get('소송')): memo_list.append(f"소송관련: {str(row.get('소송'))}")
    
    full_memo = " / ".join(memo_list)
    status = '정상'
    if '탈퇴' in full_memo: status = '탈퇴예정'
    elif '소송' in full_memo: status = '소송중'
    elif '별세' in name: status = '사망'

    member_data = {
        "name": name,
        "phone": phone,
        "member_number": member_num,
        "tier": "1차",
        "is_registered": True,
        "status": status,
        "memo": full_memo,
        "address_legal": address,
        "unit_group": str(row.get('입주평형', ''))
    }

    try:
        # 먼저 이름으로 기존 데이터 검색
        existing = supabase.table("members").select("id").eq("name", name).execute()

        if existing.data:
            # 기존 데이터가 있으면 update
            member_id = existing.data[0]['id']
            supabase.table("members").update(member_data).eq("id", member_id).execute()
            updated_count += 1
        else:
            # 없으면 insert
            res = supabase.table("members").insert(member_data).execute()
            member_id = res.data[0]['id']

        success_count += 1
        
        # 대리인 정보 처리 (기존과 동일)
        proxy_name = row.get('대리인')
        if pd.notna(proxy_name) and str(proxy_name).strip() != name:
            p_name = clean_name(proxy_name)
            p_phone = clean_phone(row.get('대리인 연락처'))
            if p_phone == "미입력": p_phone = clean_phone(row.get('대리인연락처'))
            
            p_relation = str(row.get('대리관계', ''))
            
            # 대리인 중복 방지를 위해 먼저 검색해보고 없으면 추가
            # (간단하게 구현하기 위해 insert 시도하되 에러나면 무시)
            rel_data = {
                "member_id": member_id,
                "name": p_name,
                "phone": p_phone,
                "relation": p_relation,
                "note": "자동등록"
            }
            try:
                supabase.table("relationships").insert(rel_data).execute()
                print(f"  ✅ 조합원: {name} -> 🔗 대리인 추가: {p_name}")
            except:
                pass # 이미 있으면 패스
        else:
            print(f"  ✅ 조합원: {name} ({phone})")

    except Exception as e:
        print(f"  ℹ️ 처리 중 알림 ({name}): {e}")

print("-" * 30)
print(f"🎉 작업 완료!")
print(f"👉 총 처리된 조합원 수: {success_count}명 (116명이면 성공!)")