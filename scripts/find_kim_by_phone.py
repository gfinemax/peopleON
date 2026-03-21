import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

phone = '010-9101-5448'
phone_clean = '01091015448'

try:
    res = supabase.table('account_entities').select('id, display_name, phone').or_(f"phone.ilike.%{phone}%,phone.ilike.%{phone_clean}%").execute()
    import json
    print(json.dumps(res.data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
