# Security Specification: World Cup 2026 Predictor

## Data invariants

1. A prediction belongs to exactly one authenticated Supabase user and one community.
2. A user can only participate in a community when `community_memberships.status = 'approved'`.
3. Point totals are calculated by `recalculate_points()` and should not be written by players.
4. Match, team, result, scorer-goal and sync data are admin/service-role writes only.
5. Group, scorer, match and knockout predictions are owner-writes only inside the selected community.
6. Deadlines are enforced in the application and should also be mirrored in any future database trigger:
   - Groups, classified teams and scorer: 11 June 2026, 20:30 Europe/Madrid.
   - Full knockout bracket: 28 June 2026, 10:00 Europe/Madrid.
7. Prediction visibility is owner/admin before closure; social reveal views must only show closed markets.

## Rejection tests

1. User tries to update `total_points` directly.
2. User tries to create a prediction under another user ID.
3. Pending user tries to save a prediction.
4. User edits a group prediction after the group deadline.
5. User edits a match prediction after the applicable lock time.
6. User tries to approve themselves.
7. User tries to write `matches` or `teams`.
8. User tries to set another user's scorer.
9. User tries to delete another user's prediction.
10. Anonymous visitor tries to read private predictions.
11. Admin correction changes a result and ranking recalculates idempotently.
12. FIFA sync runs twice and does not duplicate matches or teams.

## Server-side controls

- Supabase RLS policies are defined in `supabase/migrations`.
- Admin-only writes depend on `public.is_admin()`.
- Approved-player writes depend on `public.is_community_approved(community_id)`.
- Ranking is rebuilt from source tables through `public.recalculate_points()`.
