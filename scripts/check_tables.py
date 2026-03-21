import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

tables = ['account_entities', 'asset_rights', 'certificate_registry', 'membership_roles', 'person_certificate_summaries']

for table in tables:
    try:
        response = supabase.table(table).select('*').limit(1).execute()
        print(f"Table '{table}' exists.")
        if response.data:
            print(f"  Columns: {list(response.data[0].keys())}")
        else:
            print(f"  Table is empty.")
    except Exception as e:
        print(f"Table '{table}' error: {e}")
