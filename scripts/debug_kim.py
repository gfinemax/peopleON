import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

entity_id = '656e0807-1dda-4568-9078-3053a52df857'

try:
    entity = supabase.table('account_entities').select('*').eq('id', entity_id).execute()
    print("Entity Details:")
    print(entity.data)
    
    # Try multiple tables that might hold certificate info
    for table in ['asset_rights', 'certificate_registry', 'membership_roles']:
        try:
            res = supabase.table(table).select('*').eq('entity_id' if table != 'id' else 'id', entity_id).execute()
            print(f"\nTable '{table}' results:")
            print(res.data)
        except Exception as e:
            print(f"\nTable '{table}' error: {e}")

    # Also search for other "김점이" just in case
    others = supabase.table('account_entities').select('id, display_name').ilike('display_name', '%김점이%').execute()
    print("\nOther '김점이' records:")
    print(others.data)

except Exception as e:
    print(f"Error: {e}")
