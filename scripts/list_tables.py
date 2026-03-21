import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

try:
    # Use RPC to get tables if possible, or just try to select from a non-existent one to see the error message hint
    # Actually, let's try a direct SQL query via RPC if available
    # Or just try to access common table names
    tables_to_check = [
        'account_entities', 'asset_rights', 'certificate_registry', 
        'membership_roles', 'person_certificate_summaries', 'audit_logs',
        'interaction_logs', 'settlement_cases', 'settlement_lines', 'refund_payments'
    ]
    
    for table in tables_to_check:
        try:
            res = supabase.table(table).select('id').limit(1).execute()
            print(f"Table '{table}': EXISTS")
        except Exception as e:
            print(f"Table '{table}': ERROR/MISSING - {e}")

except Exception as e:
    print(f"Error: {e}")
