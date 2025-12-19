# App Recovery Guide

## Current Status (as of 2025-12-19)

Your app is **broken** because:
1. The Upstash vector database hit its daily write limit (10,000 operations)
2. The database is empty or has incomplete data
3. **Cannot fix until the limit resets** (tomorrow at midnight UTC)

## How to Fix Tomorrow

When the Upstash limit resets, run these commands:

```bash
# 1. Reset the vector database (clears all data)
npx tsx scripts/reset-vector-db.ts

# 2. Upload the knowledge base
npm run add-knowledge-improved
```

This will upload ~1,632 chunks to the database and your app will work again.

## What Was Fixed (Don't Lose These Changes!)

### File: `app/api/query/route.ts`
- **Line 116**: Changed to read `result.data` instead of `metadata.content`
- **Lines 97-105**: Updated filter to handle both old and new ID formats
- **Lines 142-145**: Fixed sources to use metadata fields

### File: `scripts/improved-chunking.ts`
- **Lines 4-7**: Added dotenv config to load `.env.local`
- **Line 85**: Added `.trim()` to handle Windows line endings
- **Lines 62-67**: Fixed `normalizeForId()` to remove ALL special characters (no hyphens)

### File: `.env.local`
- Removed the `VERCEL_OIDC_TOKEN` line (was unnecessary)
- Kept only the 4 required environment variables

## Understanding the Problem

**The ID Mismatch Issue:**
- Your centres list uses IDs like: `ascotvale`, `albanycreek`, `auburnruth`
- The upload script was creating: `ascot-vale-opening-hours` (with hyphens)
- The API filter couldn't match them

**The Fix:**
- Upload script now creates: `ascotvale-openinghours-chunk-0` (no hyphens between words)
- API filter now handles both formats for backward compatibility

## If You Get Stranded Again

1. **Check if database has data:**
   - Look at server logs for "All results count: 0"
   - If 0, database is empty

2. **Check Upstash limits:**
   - Error message: "Exceeded daily write limit: 10000"
   - Wait until midnight UTC for reset

3. **Verify environment variables are loaded:**
   - Scripts need `dotenv.config({ path: '.env.local' })`
   - Check if error says "UPSTASH_VECTOR_REST_TOKEN is missing"

4. **Check if old data is causing issues:**
   - Look for mixed IDs in logs: `bright-opening-hours-chunk-0` AND `bright-openinghours-chunk-0`
   - If mixed: Reset database first

## Quick Health Check

Run this to test if database has data:
```bash
# Will show "All results count: 10" if working, "All results count: 0" if empty
# Just make a query from the web UI and check server logs
```

## Key Files to Never Lose

- `app/api/query/route.ts` - The API with all the fixes
- `scripts/improved-chunking.ts` - The upload script with fixes
- `.env.local` - Your API keys
- `data/knowledge-base-clean.md` - Your knowledge base source

## Emergency Contact

If completely stuck:
1. Check this file first
2. Check git history: `git log --oneline`
3. Look for commits with messages about "Fix" or "Update"
4. The working state should be the latest commits

## What NOT to Do

- ❌ Don't run upload scripts multiple times in a row (hits rate limit)
- ❌ Don't reset database without a clear reason
- ❌ Don't modify the `normalizeForId()` function in upload script
- ❌ Don't change the filter logic in API route without testing

## Expected Behavior When Working

1. User selects a centre (e.g., "Albany Creek")
2. User asks "what are the opening hours?"
3. Server logs show:
   ```
   All results count: 10
   First 5 result IDs: [ 'albanycreek-openinghours-chunk-0', ... ]
   Filtered to 3 results for albanycreek
   ```
4. API returns a proper answer with opening hours

## Current Known Issues

- Upstash daily write limit is 10,000 operations
- Each chunk upload = 1 operation
- ~1,632 chunks = need to be careful with resets
- Hit limit = wait until midnight UTC

---

**Last Updated:** 2025-12-19
**Status:** Waiting for Upstash limit reset
**Next Action:** Run reset + upload commands tomorrow
