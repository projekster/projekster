import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Dit is de 'stekker' die we straks door de hele website gebruiken
export const supabase = createClient(supabaseUrl, supabaseAnonKey)