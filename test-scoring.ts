/**
 * Test script for embedding scoring system
 * Run with: npx tsx test-scoring.ts
 */

// Copy of scoring functions for testing
function normalizeVectorScore(
    rawScore: number,
    scores: number[] // Pass all scores for percentile calculation
): number {
    // Sort scores for percentile calculation
    const sortedScores = [...scores].sort((a, b) => a - b);
    
    // Calculate correct percentile: count of scores <= rawScore / total
    const countBelowOrEqual = sortedScores.filter(s => s <= rawScore).length;
    const percentile = countBelowOrEqual / sortedScores.length;
    
    // Map to display range with better curve
    const MIN_DISPLAY = 0.40;
    const MAX_DISPLAY = 0.96;
    
    // Use a slight curve to emphasize top matches
    const curvedPercentile = Math.pow(percentile, 0.9); // Slight curve
    
    return MIN_DISPLAY + (curvedPercentile * (MAX_DISPLAY - MIN_DISPLAY));
}

/**
 * Extracts a numeric difficulty score from a course's difficulty field.
 */
function extractDifficultyScore(difficulty: string | null | undefined): number | null {
    if (!difficulty) return null;
    
    try {
        const diffObj = typeof difficulty === 'string' ? JSON.parse(difficulty) : difficulty;
        
        // Prefer weighted_difficulty_score if available
        if (typeof diffObj.weighted_difficulty_score === 'number') {
            return diffObj.weighted_difficulty_score;
        }
        
        // Otherwise, calculate average of available sub-scores
        const scores: number[] = [];
        if (typeof diffObj.conceptual_depth === 'number') scores.push(diffObj.conceptual_depth);
        if (typeof diffObj.reading_intensity === 'number') scores.push(diffObj.reading_intensity);
        if (typeof diffObj.project_complexity === 'number') scores.push(diffObj.project_complexity);
        if (typeof diffObj.assessments === 'number') scores.push(diffObj.assessments);
        
        if (scores.length > 0) {
            return scores.reduce((sum, score) => sum + score, 0) / scores.length;
        }
        
        return null;
    } catch {
        return null;
    }
}

function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'him',
        'she', 'her', 'it', 'its', 'they', 'them', 'what', 'which', 'who', 'whom',
        'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
        'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
        'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
        'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
        'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
        'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
        'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just',
        'don', 'should', 'now', 'want', 'like', 'would', 'could', 'also', 'get',
        'work', 'working', 'interested', 'interest', 'learn', 'learning', 'study',
        'studying', 'course', 'courses', 'class', 'classes', 'take', 'taken', 'took'
    ]);
    
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}

function calculateMatchScore(
    normalizedScore: number,
    course: any,
    queryKeywords: string[],
    pastCourseIds: Set<string>,
    userLevel?: string,
    userMajor?: string,
    userAverageDifficulty?: number | null
): number {
    const tags = typeof course.tags === 'string' 
        ? JSON.parse(course.tags || '[]') 
        : course.tags || [];
    
    let keyTopics: string[] = [];
    try {
        keyTopics = typeof course.key_topics === 'string' 
            ? JSON.parse(course.key_topics || '[]') 
            : course.key_topics || [];
    } catch {
        keyTopics = [];
    }
    
    // Enhanced keyword matching with better scoring
    let keywordBoost = 0;
    const searchableText = `${course.title} ${course.description} ${tags.join(' ')} ${keyTopics.join(' ')}`.toLowerCase();
    
    for (const keyword of queryKeywords) {
        if (searchableText.includes(keyword)) {
            // Weight matches in title/description higher
            if (course.title.toLowerCase().includes(keyword) || 
                course.description.toLowerCase().includes(keyword)) {
                keywordBoost += 0.03; // Higher weight for title/description matches
            } else {
                keywordBoost += 0.015; // Lower weight for tag/topic matches
            }
        }
    }
    // Cap keyword boost but allow more if many matches
    keywordBoost = Math.min(keywordBoost, 0.12);
    
    // Enhanced prerequisite matching
    let prereqBoost = 0;
    if (course.prerequisites) {
        const prereqs = typeof course.prerequisites === 'string' 
            ? JSON.parse(course.prerequisites || '[]') 
            : course.prerequisites || [];
        
        const matchedPrereqs = prereqs.filter((p: string) => pastCourseIds.has(p.toUpperCase()));
        if (matchedPrereqs.length > 0) {
            // Boost more if user has ALL prerequisites
            if (matchedPrereqs.length === prereqs.length) {
                prereqBoost = 0.10; // Full prerequisite match
            } else {
                prereqBoost = Math.min(matchedPrereqs.length * 0.04, 0.08); // Partial match
            }
        } else if (prereqs.length === 0) {
            // Bonus for courses with no prerequisites (accessible)
            prereqBoost = 0.02;
        }
    }
    
    // Level appropriateness boost
    let levelBoost = 0;
    if (userLevel && course.level) {
        const levelMatch = userLevel.toLowerCase() === course.level.toLowerCase();
        if (levelMatch) {
            levelBoost = 0.05; // Boost for appropriate level
        } else if (userLevel.toLowerCase() === 'graduate' && course.level.toLowerCase() === 'undergraduate') {
            levelBoost = -0.05; // Penalty for grad student taking undergrad course
        }
    }
    
    // Major alignment boost
    let majorBoost = 0;
    if (userMajor && course.major) {
        if (userMajor.toUpperCase() === course.major.toUpperCase()) {
            majorBoost = 0.08; // Strong boost for major courses
        }
    }
    
    // Difficulty appropriateness based on user's past course experience
    let difficultyBoost = 0;
    if (course.difficulty && userAverageDifficulty !== null && userAverageDifficulty !== undefined) {
        const courseDifficulty = extractDifficultyScore(course.difficulty);
        
        if (courseDifficulty !== null) {
            const difficultyDiff = courseDifficulty - userAverageDifficulty;
            
            // Boost courses that are at or slightly above user's level (encourages growth)
            // Penalize courses that are too far above or below
            if (Math.abs(difficultyDiff) < 0.5) {
                // Very close match (within 0.5, not including 0.5) - small boost
                difficultyBoost = 0.03;
            } else if (difficultyDiff >= 0.5 && difficultyDiff < 1.0) {
                // Slightly harder (0.5 to <1.0 above) - moderate boost (encourages challenge)
                difficultyBoost = 0.04;
            } else if (difficultyDiff >= 1.0 && difficultyDiff <= 1.5) {
                // Moderately harder (1.0-1.5 above) - small boost (still manageable)
                difficultyBoost = 0.02;
            } else if (difficultyDiff > 1.5) {
                // Too hard (more than 1.5 above) - small penalty
                difficultyBoost = -0.03;
            } else if (difficultyDiff <= -0.5 && difficultyDiff >= -1.0) {
                // Slightly easier (0.5-1.0 below) - neutral (no boost/penalty)
                difficultyBoost = 0;
            } else if (difficultyDiff < -1.0) {
                // Too easy (more than 1.0 below) - small penalty
                difficultyBoost = -0.02;
            }
        }
    }
    
    // Combine all boosts
    const combinedScore = normalizedScore + keywordBoost + prereqBoost + levelBoost + majorBoost + difficultyBoost;
    
    // Use a sigmoid-like function for better score distribution
    // This prevents scores from clustering too much
    const finalScore = Math.min(0.98, Math.max(0.35, combinedScore));
    
    return finalScore;
}

// Test cases
console.log('🧪 Testing Embedding Scoring System\n');
console.log('='.repeat(60));

// Test 1: Percentile normalization
console.log('\n📊 Test 1: Percentile Normalization');
const testScores = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
console.log('Raw scores:', testScores);
testScores.forEach(score => {
    const normalized = normalizeVectorScore(score, testScores);
    console.log(`  Raw: ${score.toFixed(2)} → Normalized: ${normalized.toFixed(3)}`);
});

// Test 2: Edge cases for percentile
console.log('\n📊 Test 2: Edge Cases');
const edgeScores = [0.5, 0.5, 0.5, 0.5, 0.5]; // All same
console.log('All same scores:', edgeScores);
edgeScores.forEach(score => {
    const normalized = normalizeVectorScore(score, edgeScores);
    console.log(`  Raw: ${score.toFixed(2)} → Normalized: ${normalized.toFixed(3)}`);
});

// Test 3: Keyword extraction
console.log('\n🔍 Test 3: Keyword Extraction');
const testQueries = [
    "I'm interested in machine learning and data science",
    "I want to learn about artificial intelligence",
    "Looking for courses on web development and programming"
];
testQueries.forEach(query => {
    const keywords = extractKeywords(query);
    console.log(`  Query: "${query}"`);
    console.log(`  Keywords: [${keywords.join(', ')}]`);
});

// Test 4: Full scoring with mock courses
console.log('\n🎯 Test 4: Full Scoring with Mock Courses');

const mockCourses = [
    {
        id: 'CS101',
        title: 'Introduction to Machine Learning',
        description: 'Learn the fundamentals of machine learning algorithms and applications',
        tags: JSON.stringify(['machine learning', 'AI', 'algorithms']),
        key_topics: JSON.stringify(['neural networks', 'supervised learning']),
        prerequisites: JSON.stringify(['CS100']),
        level: 'undergraduate',
        major: 'CS',
        difficulty: JSON.stringify({ weighted_difficulty_score: 2.5 }) // Moderate difficulty
    },
    {
        id: 'CS102',
        title: 'Advanced Data Science',
        description: 'Deep dive into data analysis and statistical modeling',
        tags: JSON.stringify(['data science', 'statistics', 'analytics']),
        key_topics: JSON.stringify(['regression', 'classification']),
        prerequisites: JSON.stringify([]),
        level: 'graduate',
        major: 'CS',
        difficulty: JSON.stringify({ weighted_difficulty_score: 4.0 }) // Hard difficulty
    },
    {
        id: 'CS103',
        title: 'Web Development Basics',
        description: 'Introduction to building web applications',
        tags: JSON.stringify(['web development', 'programming']),
        key_topics: JSON.stringify(['HTML', 'CSS', 'JavaScript']),
        prerequisites: JSON.stringify(['CS100']),
        level: 'undergraduate',
        major: 'CS',
        difficulty: JSON.stringify({ weighted_difficulty_score: 1.5 }) // Easy difficulty
    },
    {
        id: 'CS104',
        title: 'Intermediate Algorithms',
        description: 'Advanced algorithmic techniques and data structures',
        tags: JSON.stringify(['algorithms', 'data structures']),
        key_topics: JSON.stringify(['dynamic programming', 'graphs']),
        prerequisites: JSON.stringify(['CS100']),
        level: 'undergraduate',
        major: 'CS',
        difficulty: JSON.stringify({ weighted_difficulty_score: 3.0 }) // Moderate-hard difficulty
    }
];

const userBio = "I'm interested in machine learning and data science";
const userCareer = "Want to become a data scientist";
const pastCourses = "CS100";
const userLevel = "undergraduate";
const userMajor = "CS";

const queryKeywords = extractKeywords(`${userBio} ${userCareer}`);
const pastCourseIds = new Set(pastCourses.split(',').map(id => id.trim().toUpperCase()));

// Calculate user's average difficulty from past courses
// Simulate CS100 having a difficulty of 2.0 (beginner-intermediate)
const pastCourseDifficulties = [2.0]; // CS100 difficulty
const userAverageDifficulty = pastCourseDifficulties.length > 0
    ? pastCourseDifficulties.reduce((sum, score) => sum + score, 0) / pastCourseDifficulties.length
    : null;

// Simulate vector scores (normally from vectorize.query)
const mockVectorScores = [0.85, 0.75, 0.65, 0.70]; // High, medium, low, medium similarity
const allRawScores = mockVectorScores;

console.log(`\nUser Profile:`);
console.log(`  Bio: "${userBio}"`);
console.log(`  Career: "${userCareer}"`);
console.log(`  Past Courses: ${pastCourses}`);
console.log(`  Level: ${userLevel}, Major: ${userMajor}`);
console.log(`  Average Difficulty: ${userAverageDifficulty !== null ? userAverageDifficulty.toFixed(2) : 'N/A'}`);
console.log(`  Extracted Keywords: [${queryKeywords.join(', ')}]`);

console.log(`\nCourse Scoring Results:\n`);

const scoredCourses = mockCourses.map((course, idx) => {
    const rawScore = mockVectorScores[idx];
    const normalizedScore = normalizeVectorScore(rawScore, allRawScores);
    const finalScore = calculateMatchScore(
        normalizedScore,
        course,
        queryKeywords,
        pastCourseIds,
        userLevel,
        userMajor,
        userAverageDifficulty
    );
    
    // Extract difficulty for display
    const courseDifficulty = extractDifficultyScore(course.difficulty);
    
    return {
        ...course,
        rawScore,
        normalizedScore,
        finalScore,
        courseDifficulty
    };
});

// Sort by final score
scoredCourses.sort((a, b) => b.finalScore - a.finalScore);

scoredCourses.forEach((course, idx) => {
    console.log(`${idx + 1}. ${course.title}`);
    console.log(`   Raw Vector Score: ${course.rawScore.toFixed(3)}`);
    console.log(`   Normalized Score: ${course.normalizedScore.toFixed(3)}`);
    console.log(`   Course Difficulty: ${course.courseDifficulty !== null ? course.courseDifficulty.toFixed(2) : 'N/A'}`);
    if (userAverageDifficulty !== null && course.courseDifficulty !== null) {
        const diff = course.courseDifficulty - userAverageDifficulty;
        console.log(`   Difficulty Diff: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} (user avg: ${userAverageDifficulty.toFixed(2)})`);
    }
    console.log(`   Final Score: ${course.finalScore.toFixed(3)}`);
    console.log(`   Level: ${course.level}, Major: ${course.major}`);
    console.log(`   Prerequisites: ${course.prerequisites ? JSON.parse(course.prerequisites).join(', ') || 'None' : 'None'}`);
    console.log('');
});

// Test 5: Score distribution analysis
console.log('\n📈 Test 5: Score Distribution Analysis');
const distributionScores = scoredCourses.map(c => c.finalScore);
const minScore = Math.min(...distributionScores);
const maxScore = Math.max(...distributionScores);
const avgScore = distributionScores.reduce((a, b) => a + b, 0) / distributionScores.length;

console.log(`  Min Score: ${minScore.toFixed(3)}`);
console.log(`  Max Score: ${maxScore.toFixed(3)}`);
console.log(`  Avg Score: ${avgScore.toFixed(3)}`);
console.log(`  Range: ${(maxScore - minScore).toFixed(3)}`);
console.log(`  Scores are within bounds: ${minScore >= 0.35 && maxScore <= 0.98 ? '✅' : '❌'}`);

// Test 6: Boost breakdown for top course
console.log('\n🔬 Test 6: Boost Breakdown (Top Course)');
const topCourse = scoredCourses[0];
const topNormalized = topCourse.normalizedScore;

// Recalculate to show breakdown
const tags = JSON.parse(topCourse.tags);
const keyTopics = JSON.parse(topCourse.key_topics);
const searchableText = `${topCourse.title} ${topCourse.description} ${tags.join(' ')} ${keyTopics.join(' ')}`.toLowerCase();

let keywordBoost = 0;
for (const keyword of queryKeywords) {
    if (searchableText.includes(keyword)) {
        if (topCourse.title.toLowerCase().includes(keyword) || 
            topCourse.description.toLowerCase().includes(keyword)) {
            keywordBoost += 0.03;
        } else {
            keywordBoost += 0.015;
        }
    }
}
keywordBoost = Math.min(keywordBoost, 0.12);

let prereqBoost = 0;
const prereqs = JSON.parse(topCourse.prerequisites);
const matchedPrereqs = prereqs.filter((p: string) => pastCourseIds.has(p.toUpperCase()));
if (matchedPrereqs.length > 0) {
    if (matchedPrereqs.length === prereqs.length) {
        prereqBoost = 0.10;
    } else {
        prereqBoost = Math.min(matchedPrereqs.length * 0.04, 0.08);
    }
} else if (prereqs.length === 0) {
    prereqBoost = 0.02;
}

const levelBoost = userLevel && topCourse.level && 
    userLevel.toLowerCase() === topCourse.level.toLowerCase() ? 0.05 : 0;
const majorBoost = userMajor && topCourse.major && 
    userMajor.toUpperCase() === topCourse.major.toUpperCase() ? 0.08 : 0;

// Calculate difficulty boost (must match calculateMatchScore logic exactly)
let difficultyBoost = 0;
if (topCourse.difficulty && userAverageDifficulty !== null) {
    const courseDifficulty = extractDifficultyScore(topCourse.difficulty);
    if (courseDifficulty !== null) {
        const difficultyDiff = courseDifficulty - userAverageDifficulty;
        // Match the exact boundary conditions from calculateMatchScore
        if (Math.abs(difficultyDiff) < 0.5) {
            // Very close match (within 0.5, not including 0.5) - small boost
            difficultyBoost = 0.03;
        } else if (difficultyDiff >= 0.5 && difficultyDiff < 1.0) {
            // Slightly harder (0.5 to <1.0 above) - moderate boost (encourages challenge)
            difficultyBoost = 0.04;
        } else if (difficultyDiff >= 1.0 && difficultyDiff <= 1.5) {
            // Moderately harder (1.0-1.5 above) - small boost (still manageable)
            difficultyBoost = 0.02;
        } else if (difficultyDiff > 1.5) {
            // Too hard (more than 1.5 above) - small penalty
            difficultyBoost = -0.03;
            } else if (difficultyDiff <= -0.5 && difficultyDiff >= -1.0) {
                // Slightly easier (0.5-1.0 below) - neutral (no boost/penalty)
                difficultyBoost = 0;
            } else if (difficultyDiff < -1.0) {
            // Too easy (more than 1.0 below) - small penalty
            difficultyBoost = -0.02;
        }
    }
}

console.log(`Course: ${topCourse.title}`);
console.log(`  Base (normalized vector): ${topNormalized.toFixed(3)}`);
console.log(`  + Keyword boost: ${keywordBoost.toFixed(3)}`);
console.log(`  + Prerequisite boost: ${prereqBoost.toFixed(3)}`);
console.log(`  + Level boost: ${levelBoost.toFixed(3)}`);
console.log(`  + Major boost: ${majorBoost.toFixed(3)}`);
console.log(`  + Difficulty boost: ${difficultyBoost > 0 ? '+' : ''}${difficultyBoost.toFixed(3)}`);
console.log(`  = Final Score: ${topCourse.finalScore.toFixed(3)}`);

// Test 7: Difficulty scoring scenarios
console.log('\n🎓 Test 7: Difficulty Scoring Scenarios');
console.log(`User's average difficulty: ${userAverageDifficulty !== null ? userAverageDifficulty.toFixed(2) : 'N/A'}\n`);

const difficultyScenarios = [
    { name: 'Perfect Match', courseDiff: 2.0, expected: 'Small boost (+0.03)' },
    { name: 'Slightly Harder', courseDiff: 2.5, expected: 'Moderate boost (+0.04)' },
  { name: 'Exactly 0.5 Above', courseDiff: 2.5, expected: 'Moderate boost (+0.04)' },
    { name: 'Moderately Harder (1.0)', courseDiff: 3.0, expected: 'Small boost (+0.02)' },
  { name: 'Moderately Harder (1.5)', courseDiff: 3.5, expected: 'Small boost (+0.02)' },
    { name: 'Too Hard', courseDiff: 4.0, expected: 'Penalty (-0.03)' },
    { name: 'Slightly Easier', courseDiff: 1.5, expected: 'Neutral (0.00)' },
    { name: 'Too Easy', courseDiff: 0.5, expected: 'Penalty (-0.02)' }
];

difficultyScenarios.forEach(scenario => {
    const diff = scenario.courseDiff - (userAverageDifficulty || 0);
    let boost = 0;
    if (Math.abs(diff) < 0.5) {
        boost = 0.03;
    } else if (diff >= 0.5 && diff < 1.0) {
        boost = 0.04;
    } else if (diff >= 1.0 && diff <= 1.5) {
        boost = 0.02;
    } else if (diff > 1.5) {
        boost = -0.03;
    } else if (diff <= -0.5 && diff >= -1.0) {
        boost = 0;
    } else if (diff < -1.0) {
        boost = -0.02;
    }
    
    console.log(`  ${scenario.name}:`);
    console.log(`    Course Difficulty: ${scenario.courseDiff.toFixed(2)}`);
    console.log(`    Difference: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
    console.log(`    Boost Applied: ${boost > 0 ? '+' : ''}${boost.toFixed(3)} ${boost === 0 ? '(neutral)' : ''}`);
    console.log(`    Expected: ${scenario.expected}`);
    console.log('');
});

// Test 8: Edge cases for difficulty parsing
console.log('\n🛡️ Test 8: Difficulty Parsing Edge Cases');
const edgeCaseDifficulties = [
    { name: 'Valid JSON object', value: JSON.stringify({ weighted_difficulty_score: 3.0 }), expected: 3.0 },
    { name: 'Plain string (invalid)', value: 'intermediate', expected: null },
    { name: 'Plain string (invalid)', value: 'advanced', expected: null },
    { name: 'Plain string (invalid)', value: 'beginner', expected: null },
    { name: 'Empty string', value: '', expected: null },
    { name: 'Null', value: null, expected: null },
    { name: 'Undefined', value: undefined, expected: null },
    { name: 'Invalid JSON', value: '{invalid json}', expected: null },
    { name: 'JSON with sub-scores only', value: JSON.stringify({ conceptual_depth: 3, reading_intensity: 4 }), expected: 3.5 },
    { name: 'JSON with no scores', value: JSON.stringify({}), expected: null },
];

edgeCaseDifficulties.forEach(testCase => {
    const result = extractDifficultyScore(testCase.value as any);
    const passed = result === testCase.expected || (testCase.expected !== null && Math.abs(result! - testCase.expected) < 0.01);
    console.log(`  ${testCase.name}:`);
    console.log(`    Input: ${testCase.value === null ? 'null' : testCase.value === undefined ? 'undefined' : typeof testCase.value === 'string' && testCase.value.length > 30 ? testCase.value.substring(0, 30) + '...' : testCase.value}`);
    console.log(`    Result: ${result !== null ? result.toFixed(2) : 'null'}`);
    console.log(`    Expected: ${testCase.expected !== null ? testCase.expected.toFixed(2) : 'null'}`);
    console.log(`    Status: ${passed ? '✅' : '❌'}`);
    console.log('');
});

console.log('='.repeat(60));
console.log('✅ Testing complete!');
