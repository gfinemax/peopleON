import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('.env.local')

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

name_to_search = '김점이'

try:
    # 1. Find entities
    entities = supabase.table('account_entities').select('*').ilike('display_name', f'%{name_to_search}%').execute()
    print(f"Entities found for '{name_to_search}':")
    for entity in entities.data:
        print(f"ID: {entity['id']}, Name: {entity['display_name']}, Phone: {entity.get('phone')}")
        
        # 2. Find certificates for each entity in certificate_registry
        certs = supabase.table('certificate_registry').select('*').eq('entity_id', entity['id']).execute()
        if certs.data:
            print(f"  Certificates (Registry):")
            for cert in certs.data:
                print(f"    ID: {cert['id']}, Raw: {cert['certificate_number_raw']}, Normalized: {cert['certificate_number_normalized']}, Status: {cert['certificate_status']}, Active: {cert['is_active']}")
        else:
            print(f"  No certificates in Registry.")
            
        # 3. Find certificates in asset_rights (Legacy?)
        rights = supabase.table('asset_rights').select('*').eq('entity_id', entity['id']).execute()
        if rights.data:
            print(f"  Asset Rights (Legacy):")
            for right in rights.data:
                print(f"    ID: {right['id']}, Type: {right.get('right_type')}, Number: {right.get('right_number')}, Raw: {right.get('right_number_raw')}")
        else:
             print(f"  No Asset Rights.")

except Exception as e:
    print(f"Error: {e}")
