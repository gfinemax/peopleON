import { createBrowserClient } from '@supabase/ssr'
import { createDeduplicatedFetch } from './deduplicateFetch'

const deduplicatedFetch = createDeduplicatedFetch();

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: deduplicatedFetch as typeof fetch } }
  )
}
