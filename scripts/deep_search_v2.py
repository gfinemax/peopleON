import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

search_str = '05-1-6'

try:
    # Search in certificate_registry and show full row
    res = supabase.table('certificate_registry').select('*').or_(f"certificate_number_raw.ilike.%{search_str}%,certificate_number_normalized.ilike.%{search_str}%,note.ilike.%{search_str}%").execute()
    import json
    print("Matches in certificate_registry:")
    print(json.dumps(res.data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")

try:
    # Search in account_entities and show full row
    res = supabase.table('account_entities').select('*').or_(f"display_name.ilike.%{search_str}%,phone.ilike.%{search_str}%,memo.ilike.%{search_str}%").execute()
    print("\nMatches in account_entities:")
    print(json.dumps(res.data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
