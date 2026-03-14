# Presswave Frontend — Sub-Agent Rules

## ⛔ CRITICAL: Supabase Anon Key
The Supabase anon key is NOT a JWT. It starts with `sb_publishable_`.
**DO NOT** replace it with a JWT-format string (eyJhbG...).
**DO NOT** modify the SUPABASE_ANON_KEY constant in index.html.
The correct value is in `.env.frontend`. Always verify after any edit.

## Constants (DO NOT CHANGE)
```
SUPABASE_URL = https://vfjsyyextdvrvtirdpbh.supabase.co
SUPABASE_ANON_KEY = sb_publishable_-Ko6Dknctb-MzN6ekceoWg_kUSJ6Hl5
```

## Post-deploy checklist
1. Grep index.html for `eyJhbG` — if found, the key was fabricated. Fix it.
2. Verify SUPABASE_ANON_KEY starts with `sb_publishable_`
