import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

entity_id = '656e0807-1dda-4568-9078-3053a52df857'
results = {}

try:
    entity = supabase.table('account_entities').select('*').eq('id', entity_id).execute()
    results['entity'] = entity.data
    
    for table in ['asset_rights', 'certificate_registry', 'membership_roles', 'person_certificate_summaries']:
        try:
            res = supabase.table(table).select('*').eq('entity_id', entity_id).execute()
            results[table] = res.data
        except Exception as e:
            results[table] = str(e)

    others = supabase.table('account_entities').select('id, display_name, phone').ilike('display_name', '%김점이%').execute()
    results['others'] = others.data

    with open('debug_kim_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("Results written to debug_kim_results.json")

except Exception as e:
    print(f"Error: {e}")
