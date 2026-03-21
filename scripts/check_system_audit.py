import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

entity_id = '656e0807-1dda-4568-9078-3053a52df857'

try:
    res = supabase.table('system_audit_logs').select('*').eq('target_entity_id', entity_id).order('created_at', desc=True).limit(20).execute()
    import json
    print(json.dumps(res.data, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
