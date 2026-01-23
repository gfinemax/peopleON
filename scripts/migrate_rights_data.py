"""
권리증 데이터 통합 마이그레이션 스크립트 (V3)
- Main Source: 권리증_최종정리_완전판(이름순).xlsx (정규화 데이터)
- Raw Source: 권리증현황(보관및호환용).xls (모든 시트 데이터)
- Target: Supabase 'legacy_records' table
"""

import os
import json
import pandas as pd
import numpy as np
from supabase import create_client, Client

# ============================================
# 설정
# ============================================
MAIN_FILE = "data/권리증_최종정리_완전판(이름순).xlsx"
RAW_FILE = "data/권리증현황(보관및호환용).xls"

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

class MigrationManager:
    def __init__(self, dry_run=True):
        self.dry_run = dry_run
        self.merged_data = {}  # {name: record_dict}
        self.supabase = self._init_supabase() if not dry_run else None

    def _init_supabase(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL/KEY 환경변수 필요")
        return create_client(SUPABASE_URL, SUPABASE_KEY)

    def normalize_name(self, name):
        """이름 정규화 (공백 제거)"""
        if pd.isna(name): return None
        return str(name).strip().replace(" ", "")

    def smart_read_sheet(self, file_path, sheet_name):
        """헤더 위치를 자동으로 찾아서 읽기"""
        try:
            # 상위 10줄 읽기
            header_search = pd.read_excel(file_path, sheet_name=sheet_name, nrows=10, header=None)
            
            # '성명'이나 '이름'이 있는 행 찾기
            name_keywords = ['성명', '이름', '회원성명', '성 명']
            header_idx = 0
            found = False
            
            for idx, row in header_search.iterrows():
                row_str = row.astype(str).values
                if any(k in s for k in name_keywords for s in row_str):
                    header_idx = idx
                    found = True
                    break
            
            # 다시 읽기
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_idx)
            
            # 이름 컬럼 식별
            name_col = None
            for col in df.columns:
                if any(k in str(col) for k in name_keywords):
                    name_col = col
                    break
            
            if not name_col and not df.empty:
                # 못 찾았으면 첫 번째 문자열 컬럼 사용 (Fallback)
                for col in df.columns:
                    if df[col].dtype == object:
                        name_col = col
                        break
            
            return df, name_col
            
        except Exception as e:
            print(f"  ⚠️ 시트 읽기 실패 ({sheet_name}): {e}")
            return None, None

    def process_main_file(self):
        """메인 파일(정규화된 데이터) 처리"""
        print(f"\n[1/4] 메인 파일 처리: {MAIN_FILE}")
        df = pd.read_excel(MAIN_FILE)
        
        for _, row in df.iterrows():
            name = self.normalize_name(row.get("성명"))
            if not name: continue
            
            # V2 로직 재사용: 기본 필드 추출
            record = {
                "original_name": name,
                "rights_count": int(row["권리증수"]) if pd.notna(row.get("권리증수")) else 0,
                "contacts": self._extract_contacts(row),
                "addresses": self._extract_addresses(row),
                "certificates": self._extract_certificates(row),
                "status_flags": self._extract_status_flags(row),
                "raw_data": {"MainSource": self._row_to_json(row)},
                "source_file": "권리증_최종정리_완전판",
                "is_refunded": True,
                "extra_info": {}  # Schema compatibility
            }
            
            self.merged_data[name] = record

    def process_raw_file(self):
        """원본 파일(모든 시트) 처리 및 병합"""
        print(f"\n[2/4] 원본 파일 통합: {RAW_FILE}")
        xls = pd.ExcelFile(RAW_FILE)
        
        for sheet in xls.sheet_names:
            print(f"  - 시트 분석: {sheet}")
            df, name_col = self.smart_read_sheet(RAW_FILE, sheet)
            
            if df is None or not name_col:
                print(f"    Pass (이름 컬럼 미확인)")
                continue
                
            count = 0
            for _, row in df.iterrows():
                name = self.normalize_name(row.get(name_col))
                if not name: continue
                
                row_json = self._row_to_json(row)
                
                # 기존 데이터에 병합 or 신규 생성
                if name not in self.merged_data:
                    self.merged_data[name] = {
                        "original_name": name,
                        "rights_count": 0,
                        "is_refunded": True,
                        "raw_data": {}
                    }
                
                # raw_data에 시트별 데이터 추가
                if "raw_data" not in self.merged_data[name]:
                    self.merged_data[name]["raw_data"] = {}
                
                # 시트 이름 중복 방지 (Append list if needed, here simple overwrite/append)
                if sheet in self.merged_data[name]["raw_data"]:
                   # 이미 해당 시트 데이터가 있으면 리스트로 변환하여 추가
                   existing = self.merged_data[name]["raw_data"][sheet]
                   if isinstance(existing, list):
                       existing.append(row_json)
                   else:
                       self.merged_data[name]["raw_data"][sheet] = [existing, row_json]
                else:
                    self.merged_data[name]["raw_data"][sheet] = row_json
                
                count += 1
            print(f"    -> {count}건 병합")

    def match_with_supbase(self):
        """Supabase 멤버와 매칭"""
        print("\n[3/4] 등기조합원 매칭...")
        if self.dry_run:
            print("  (Dry-run: 매칭 생략, 0명 가정)")
            members = []
        else:
            res = self.supabase.table("members").select("id, name").execute()
            members = res.data
        
        # 이름 -> ID 맵
        name_map = {}
        for m in members:
            n = self.normalize_name(m["name"])
            if n not in name_map: name_map[n] = []
            name_map[n].append(m["id"])
            
        stats = {"matched": 0, "duplicate": 0, "refunded": 0}
        
        for name, record in self.merged_data.items():
            if name in name_map:
                ids = name_map[name]
                if len(ids) == 1:
                    record["member_id"] = ids[0]
                    record["is_refunded"] = False
                    stats["matched"] += 1
                else:
                    record["member_id"] = None
                    record["needs_review"] = True
                    record["is_refunded"] = False
                    stats["duplicate"] += 1
            else:
                record["member_id"] = None
                record["is_refunded"] = True
                stats["refunded"] += 1
                
        print(f"  ✅ 매칭: {stats['matched']}, 중복: {stats['duplicate']}, 환불: {stats['refunded']}")

    def upload(self):
        """업로드"""
        print("\n[4/4] 데이터 업로드...")
        records = list(self.merged_data.values())
        print(f"  총 {len(records)}명 데이터 준비됨")
        
        # JSON 직렬화 불가 객체 처리 (NaN 등) 및 구조 점검
        clean_records = []
        for r in records:
            # raw_data가 너무 크면 문제될 수 있음 (필요시 축소)
            clean_records.append(r)

        if self.dry_run:
            print("  Dry-run 완료 (업로드 안함)")
            if len(clean_records) > 0:
                print("  샘플 데이터 (raw_data keys):", clean_records[0].get("raw_data", {}).keys())
        else:
            batch_size = 50
            for i in range(0, len(clean_records), batch_size):
                batch = clean_records[i:i+batch_size]
                try:
                    self.supabase.table("legacy_records").upsert(batch, on_conflict="original_name").execute()
                    print(f"  Progress: {i + len(batch)} / {len(clean_records)}")
                except Exception as e:
                    print(f"  ❌ Error batch {i}: {e}")

    # --- Helper Functions ---
    def _extract_contacts(self, row):
        contacts = []
        for i in range(1, 5):
            val = row.get(f"연락처_{i}")
            if pd.notna(val): contacts.append(str(val).strip())
        return contacts

    def _extract_addresses(self, row):
        addrs = []
        for i in range(1, 4):
            val = row.get(f"주소_{i}")
            if pd.notna(val): addrs.append(str(val).strip())
        return addrs

    def _extract_certificates(self, row):
        certs = []
        for i in range(1, 5):
            no = row.get(f"필증NO_{i}")
            if pd.notna(no):
                certs.append({
                    "no": str(no),
                    "name": str(row.get(f"필증성명_{i}", "")),
                    "date": str(row.get(f"필증일자_{i}", "")),
                    "price": str(row.get(f"가격_{i}", ""))
                })
        return certs
        
    def _extract_status_flags(self, row):
        flags = {}
        for col in ["권리위임", "서류제출", "모임참석"]:
            if pd.notna(row.get(col)): flags[col] = str(row[col])
        return flags

    def _row_to_json(self, row):
        """Pandas Row -> JSON Dictionary (Handle NaN)"""
        d = {}
        for k, v in row.items():
            if pd.notna(v):
                # Timestamp 처리
                if isinstance(v, pd.Timestamp):
                    d[k] = v.strftime('%Y-%m-%d')
                else:
                    d[k] = str(v)
        return d

if __name__ == "__main__":
    import sys
    dry_run = "--run" not in sys.argv
    
    mgr = MigrationManager(dry_run)
    mgr.process_main_file()
    mgr.process_raw_file()
    mgr.match_with_supbase()
    mgr.upload()

