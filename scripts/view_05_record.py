import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

record_id = '2a845e72-8830-4bf9-9880-65bad530cdba'

try:
    res = supabase.table('certificate_registry').select('*').eq('id', record_id).execute()
    import json
    print(json.dumps(res.data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
