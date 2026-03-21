import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

search_str = '05-1-6'

tables = [
    'account_entities', 'certificate_registry', 'membership_roles', 
    'audit_logs', 'system_audit_logs', 'interaction_logs', 
    'settlement_cases', 'settlement_lines', 'refund_payments',
    'entity_relationships', 'entity_private_info', 'payments'
]

for table in tables:
    try:
        # We can't search across all columns easily with PostgREST 
        # but we can try common ones or use 'ilike' on a joined string if supported
        # For now, let's just try to find it in any text column we know
        if table == 'account_entities':
            res = supabase.table(table).select('id').or_(f"display_name.ilike.%{search_str}%,phone.ilike.%{search_str}%,memo.ilike.%{search_str}%").execute()
        elif table == 'certificate_registry':
            res = supabase.table(table).select('id').or_(f"certificate_number_raw.ilike.%{search_str}%,certificate_number_normalized.ilike.%{search_str}%,note.ilike.%{search_str}%").execute()
        else:
            # Generic check if possible or skip
            continue
            
        if res.data:
            print(f"Found in {table}: {res.data}")
    except Exception as e:
        # print(f"Error checking {table}: {e}")
        pass
