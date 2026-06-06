import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Jedan zajednički Supabase klijent za cijelu aplikaciju (radi u pregledniku).
export const supabase = createClient(url, anonKey)
