import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

entity_id = '656e0807-1dda-4568-9078-3053a52df857'

try:
    res = supabase.table('account_entities').select('id, display_name, member_number').eq('id', entity_id).execute()
    print(f"Results for {entity_id}:")
    print(res.data)
except Exception as e:
    print(f"Error: {e}")
