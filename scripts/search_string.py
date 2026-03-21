import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

search_val = '05-1-6'

try:
    print(f"Searching for '{search_val}'...")
    
    # Check account_entities (member_number or other fields)
    res = supabase.table('account_entities').select('*').or(f"member_number.eq.{search_val},memo.ilike.%{search_val}%").execute()
    if res.data:
        print(f"Found in account_entities: {res.data}")
    else:
        print("Not found in account_entities.")

    # Check certificate_registry
    res = supabase.table('certificate_registry').select('*').or(f"certificate_number_raw.eq.{search_val},certificate_number_normalized.eq.{search_val}").execute()
    if res.data:
        print(f"Found in certificate_registry: {res.data}")
    else:
        print("Not found in certificate_registry.")

    # Search in all text columns of account_entities roughly
    # (Since I don't know all columns, I'll just try common ones)
except Exception as e:
    print(f"Error: {e}")
