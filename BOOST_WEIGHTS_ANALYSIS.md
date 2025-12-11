# Boost Weights Analysis

## Current Boost Weight Configuration

### Base Score Range
- **Normalized Vector Score**: 0.40 - 0.96 (from percentile-based normalization)
- **Final Score Clamp**: 0.35 - 0.98

### Boost Weights (in order of maximum impact)

| Factor | Boost Value | Max Possible | Notes |
|--------|-------------|--------------|-------|
| **Prerequisites (Full Match)** | +0.10 | 0.10 | User has ALL prerequisites |
| **Prerequisites (Partial)** | +0.04 per match | 0.08 | Up to 2 prereqs matched |
| **Major Alignment** | +0.08 | 0.08 | Course matches user's major |
| **Keyword (Title/Desc)** | +0.03 per match | 0.12 | Capped at 0.12 total |
| **Keyword (Tags/Topics)** | +0.015 per match | 0.12 | Capped at 0.12 total |
| **Level Match** | +0.05 | 0.05 | Appropriate level |
| **No Prerequisites** | +0.02 | 0.02 | Accessibility bonus |
| **Level Penalty** | -0.05 | -0.05 | Grad taking undergrad |

---

## Detailed Analysis

### 1. **Prerequisite Matching (0.10 / 0.08 / 0.02)**

**Current Values:**
- Full match: `+0.10` (highest single boost)
- Partial match: `+0.04` per prereq (max `0.08`)
- No prereqs: `+0.02` (accessibility bonus)

**Analysis:**
✅ **Strengths:**
- Strongly prioritizes courses users can actually take
- Full match boost (0.10) is appropriately high - prerequisites are critical
- Partial match scaling (0.04 per match) is reasonable
- Accessibility bonus (0.02) encourages exploration

⚠️ **Potential Issues:**
- **0.10 is very high** - can dominate over semantic similarity
- A course with full prereqs might outrank a more relevant course without prereqs
- Example: A course with 0.85 vector score + 0.10 prereq = 0.95, while a 0.95 vector score course = 0.95 (tied)

**Recommendation:** Consider reducing to `0.08` to balance with semantic relevance, or make it multiplicative rather than additive.

---

### 2. **Major Alignment (0.08)**

**Current Value:** `+0.08`

**Analysis:**
✅ **Strengths:**
- Second-highest boost, appropriate for major requirements
- Encourages students to take courses in their field

⚠️ **Potential Issues:**
- **Very close to prerequisite boost (0.10)** - might create too much bias
- Could suppress interdisciplinary courses
- **Not currently being used** - `userMajor` is not passed to `calculateMatchScore()` in the API route (line 209-214)

**Recommendation:** 
1. **Fix the bug** - pass `userMajor` from request body
2. Consider reducing to `0.06` to allow more diversity in recommendations

---

### 3. **Keyword Matching (0.03 / 0.015, cap 0.12)**

**Current Values:**
- Title/description match: `+0.03` per keyword
- Tag/topic match: `+0.015` per keyword
- Maximum cap: `0.12` total

**Analysis:**
✅ **Strengths:**
- 2x weight for title/description (more important) vs tags
- Cap prevents keyword spam from dominating
- Reasonable per-keyword values

⚠️ **Potential Issues:**
- **Cap of 0.12 means 4 title matches or 8 tag matches** - might be too low for detailed queries
- Keyword matching is somewhat redundant with vector embeddings (which already capture semantic meaning)
- Could create false positives (e.g., "machine" matches "sewing machine")

**Recommendation:** 
- Current values are reasonable
- Consider increasing cap to `0.15` if users have very specific keyword needs
- Monitor for keyword spam issues

---

### 4. **Level Appropriateness (0.05 / -0.05)**

**Current Values:**
- Level match: `+0.05`
- Grad taking undergrad: `-0.05` (penalty)

**Analysis:**
✅ **Strengths:**
- Moderate boost encourages appropriate-level courses
- Penalty prevents grad students from gaming the system

⚠️ **Potential Issues:**
- **Not currently being used** - `userLevel` is not passed to `calculateMatchScore()` in the API route
- Only penalizes grad→undergrad, not undergrad→grad (which might be too advanced)
- `+0.05` is relatively small compared to other boosts

**Recommendation:**
1. **Fix the bug** - pass `userLevel` from request body
2. Consider adding penalty for undergrad taking grad courses
3. Current value (0.05) is appropriate

---

### 5. **No Prerequisites Bonus (0.02)**

**Current Value:** `+0.02`

**Analysis:**
✅ **Strengths:**
- Small accessibility bonus encourages exploration
- Helps beginner-friendly courses rank slightly higher

⚠️ **Potential Issues:**
- Very small compared to other boosts (might not have much effect)
- Could be redundant if vector embeddings already favor accessible courses

**Recommendation:** Current value is fine, but consider if it's having any measurable impact.

---

## Relative Impact Analysis

### Maximum Possible Boosts (theoretical)
1. **Prerequisites (full)**: +0.10
2. **Major**: +0.08
3. **Keywords**: +0.12
4. **Level**: +0.05
5. **No prereqs**: +0.02

**Total maximum boost**: +0.37 (but clamped to 0.98)

### Typical Scenarios

**Scenario 1: Perfect Match**
- Vector: 0.96 (top match)
- Keywords: +0.12 (4 title matches)
- Prerequisites: +0.10 (full match)
- Major: +0.08
- Level: +0.05
- **Total: 1.31 → clamped to 0.98**

**Scenario 2: Good Semantic Match, No Boosts**
- Vector: 0.85
- Keywords: +0.06 (2 title matches)
- Prerequisites: +0.02 (no prereqs)
- Major: 0 (different major)
- Level: 0 (not passed)
- **Total: 0.93**

**Scenario 3: Moderate Match with Prerequisites**
- Vector: 0.70
- Keywords: +0.03 (1 title match)
- Prerequisites: +0.10 (full match)
- Major: 0
- Level: 0
- **Total: 0.83**

---

## Critical Issues Found

### 🐛 **Bug 1: userLevel and userMajor Not Passed**
**Location:** `src/app/api/recommend/route.ts` lines 209-214

**Problem:** The function signature accepts `userLevel` and `userMajor`, but they're never passed when calling `calculateMatchScore()`.

**Impact:** 
- Level boost (+0.05) is never applied
- Major boost (+0.08) is never applied
- These important signals are completely ignored

**Fix Required:**
```typescript
// Current (broken):
const finalScore = calculateMatchScore(
    normalizedScore,
    course,
    queryKeywords,
    pastCourseIdsSet
);

// Should be:
const { userLevel, userMajor } = await request.json();
const finalScore = calculateMatchScore(
    normalizedScore,
    course,
    queryKeywords,
    pastCourseIdsSet,
    userLevel,
    userMajor
);
```

---

## Weight Hierarchy Analysis

### Current Hierarchy (by max impact):
1. **Prerequisites (full)**: 0.10 (20.4% of max boost)
2. **Keywords**: 0.12 (24.5% of max boost, but requires multiple matches)
3. **Major**: 0.08 (16.3% of max boost)
4. **Prerequisites (partial)**: 0.08 (16.3% of max boost)
5. **Level**: 0.05 (10.2% of max boost)
6. **No prereqs**: 0.02 (4.1% of max boost)

### Is This Balanced?

**Arguments FOR current weights:**
- Prerequisites are critical (can't take course without them)
- Major alignment is important for degree requirements
- Keywords help with explicit user intent
- Level appropriateness is nice-to-have

**Arguments AGAINST current weights:**
- Prerequisites (0.10) might be too dominant over semantic relevance
- Major (0.08) could suppress interdisciplinary learning
- Keywords (0.12 cap) might be redundant with embeddings
- Level and major boosts aren't even being used (bug)

---

## Recommendations

### High Priority
1. **Fix the bug** - Pass `userLevel` and `userMajor` to `calculateMatchScore()`
2. **Monitor score distribution** - Check if too many courses hit the 0.98 cap

### Medium Priority
3. **Consider reducing prerequisite boost** from `0.10` to `0.08` to balance with semantic similarity
4. **Consider reducing major boost** from `0.08` to `0.06` to allow more diversity
5. **Add undergrad→grad penalty** similar to grad→undergrad penalty

### Low Priority
6. **Increase keyword cap** from `0.12` to `0.15` if needed
7. **Make boosts multiplicative** instead of additive for better scaling
8. **Add difficulty-based boost** (currently unused)

---

## Test Scenarios to Validate

1. **Prerequisite dominance test**: Course with 0.70 vector + full prereqs vs 0.95 vector + no prereqs
2. **Major bias test**: Same course, one in major, one out of major
3. **Keyword spam test**: Course with many keyword matches vs high semantic similarity
4. **Score clamping test**: How many courses hit 0.98 cap?

---

## Conclusion

The current boost weights are **reasonably balanced** but have some issues:

1. **Critical Bug**: Level and major boosts aren't being applied
2. **Potential Over-weighting**: Prerequisites (0.10) might dominate semantic relevance
3. **Missing Features**: Difficulty boost is defined but unused

**Overall Assessment**: The weights make logical sense, but need the bug fix and potentially minor adjustments based on real-world usage data.
