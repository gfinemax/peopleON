import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

entity_id = '656e0807-1dda-4568-9078-3053a52df857'

try:
    # Fetch one row to get all keys
    res = supabase.table('account_entities').select('*').eq('id', entity_id).execute()
    if res.data:
        print(f"All columns for entity {entity_id}:")
        print(json.dumps(res.data[0], indent=2, ensure_ascii=False))
        
        with open('kim_details_full.json', 'w', encoding='utf-8') as f:
            json.dump(res.data[0], f, ensure_ascii=False, indent=2)
    else:
        print("Entity not found.")

except Exception as e:
    print(f"Error: {e}")
