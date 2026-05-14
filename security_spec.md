# Security Specification: Dimension Football

## Data Invariants
1. A prediction must belong to a valid user.
2. Predictions can only be created/edited before the match start time OR the stage deadline (whichever comes first).
3. Stage deadlines: 
   - Group Stage: June 10, 2026.
   - Knockout Stage: June 28, 2026.
4. Users cannot modify their own point counts (Calculated server-side).
5. Usernames must be unique (This should be handled by the registration logic, though Firestore rules can't easily check uniqueness across all docs without a dedicated collection, we'll use a `usernames` collection for this if needed, or handle it in the server-side registration).

## The Dirty Dozen Payloads (Rejection Tests)
1. **The God Update**: User tries to update `totalPoints` to 9999.
2. **The Time Traveler**: User tries to update a prediction for a match that started 10 minutes ago.
3. **The Identity Thief**: User A tries to create a prediction for User B.
4. **The Ghost Match**: User tries to create a prediction for a non-existent match ID.
5. **The Shadow Field**: User tries to add an extra field `isVerified: true` to their user profile.
6. **The Overflow**: User tries to send a 1MB string as a username.
7. **The Scorer Snatched**: User tries to change their chosen scorer after the June 10 deadline.
8. **The Deletion Frenzy**: User tries to delete someone else's prediction.
9. **The Group Stage Hack**: User tries to edit group stage standings after June 10.
10. **The Invisible Scorer**: User tries to vote for a scorer ID that doesn't exist.
11. **The Anonymous Write**: Non-signed-in user tries to create a profile.
12. **The Unverified Entry**: User with unverified email tries to join (if enforced).

## Validation Helpers logic
- `canEditMatch(matchId)`: Checks match phase, date, and stage deadline.
- `isValidUser(data)`: Enforces schema and initial points.
- `isOwner(userId)`: Ensures `request.auth.uid == userId`.
