// src/lib/transcript-parser.js
// Node.js compatible version

/**
 * Extracts courses from transcript text
 * Keeps last occurrence of duplicate courses
 * @param {string} text - Raw text from PDF
 * @returns {Object} - Course data {courseCode: {code, title, grade}}
 */
function extractCourses(text) {
    const courseMap = new Map();
    
    // Pattern: COURSECODE TITLE LEVEL GRADE CREDIT
    const pattern = /([A-Z]+)\s+(\d{3,4}[A-Z]?)\s+([\p{L}\s\.&\-']+?)\s+(UG|GR|FDY)\s+(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|S|U|W|I)\s+\d+\.\d+/gu;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const code = match[1] + match[2];
        const title = match[3].trim();
        const grade = match[5];
        
        // Skip excluded or in-progress courses
        const afterMatch = text.substring(match.index + match[0].length, match.index + match[0].length + 50);
        const isExcluded = afterMatch.includes('Excluded') || afterMatch.includes('Registered');
        
        if (!isExcluded) {
            courseMap.set(code, {
                code: code,
                title: title,
                grade: grade
            });
        }
    }
    
    return Object.fromEntries(courseMap);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractCourses };
}