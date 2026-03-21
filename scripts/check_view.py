import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

try:
    # Try to get definition via information_schema
    res = supabase.rpc('get_table_definition', {'t_name': 'account_entities'}).execute()
    print("Definition via RPC:")
    print(res.data)
except Exception as e:
    print(f"RPC Error: {e}")

try:
    # Another way: check columns in information_schema via a trick 
    # (if we have permissions, usually not for anon key)
    res = supabase.table('account_entities').select('*').limit(0).execute()
    # If the above worked, it would have columns in some metadata if using JS, 
    # but in Python we just get empty list.
    print("Columns (keys of an empty row):")
    # Try to get one row and see all keys
    res = supabase.table('account_entities').select('*').limit(1).execute()
    if res.data:
        print(res.data[0].keys())
except Exception as e:
    print(f"Select Error: {e}")
