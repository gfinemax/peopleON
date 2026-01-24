import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Query to get column names for 'relationships' table
try:
    # Try fetching one row to see keys
    response = supabase.table('relationships').select('*').limit(1).execute()
    if response.data:
        print("Columns found in 'relationships' table:")
        print(response.data[0].keys())
    else:
        print("Table 'relationships' is empty or not accessible.")
except Exception as e:
    print(f"Error: {e}")
