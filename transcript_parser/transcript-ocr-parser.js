// transcript-ocr-parser.js

const TesseractNode = typeof require !== 'undefined' ? require('tesseract.js') : null;
const sharp = typeof require !== 'undefined' ? require('sharp') : null;
const fs = typeof require !== 'undefined' ? require('fs').promises : null;

/**
 * Preprocess image for better OCR (Node.js only)
 */
async function preprocessImage(imagePath) {
    if (!sharp) return imagePath;
    
    const outputPath = imagePath.replace(/(\.[^.]+)$/, '_processed$1');
    
    await sharp(imagePath)
        .resize({ width: 2000 })
        .greyscale()
        .normalize()
        .sharpen()
        .threshold(128)
        .toFile(outputPath);
    
    return outputPath;
}

/**
 * Parse multiple bannerweb screenshots with preprocessing
 * @param {Array<string>} imagePaths - Array of image file paths
 * @returns {Promise<Object>} - Course data object
 */
async function parseMultipleScreenshots(imagePaths) {
    const TesseractLib = typeof Tesseract !== 'undefined' ? Tesseract : TesseractNode;
    
    const allCourses = {};
    
    for (const imagePath of imagePaths) {
        const processedPath = await preprocessImage(imagePath);
        
        const { data: { text } } = await TesseractLib.recognize(processedPath, 'eng', {
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-/()., :&',
            tessedit_pageseg_mode: TesseractLib.PSM ? TesseractLib.PSM.AUTO : 3,
        });
        
        const courses = extractCoursesFromBannerweb(text);
        Object.assign(allCourses, courses);
        
        if (processedPath !== imagePath && fs) {
            await fs.unlink(processedPath).catch(() => {});
        }
    }
    
    return allCourses;
}

/**
 * Extract courses from bannerweb OCR text
 * @param {string} text - OCR extracted text
 * @returns {Object} - Course data
 */
function extractCoursesFromBannerweb(text) {
    const courses = {};
    const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'S', 'U', 'W', 'I'];
    
    const lines = text.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine || trimmedLine.includes('COURSE CODE') || trimmedLine.includes('Term') || trimmedLine.includes('Cumulative')) {
            continue;
        }
        
        // Fix common OCR errors: C3300 -> CS 300
        let fixedLine = trimmedLine
            .replace(/\b([A-Z]{1,2})(\d)(\d{3})\b/g, (match, prefix, digitChar, rest) => {
                const digitToLetter = {
                    '0': 'O', '1': 'I', '3': 'S', '5': 'S', '8': 'B'
                };
                const letter = digitToLetter[digitChar] || digitChar;
                return prefix + letter + ' ' + rest;
            });
        
        const match = fixedLine.match(/^([A-Z]+)\s+(\d{3}[A-Z]?)\s+.+?\s+(UG|FDY|ue|uG|Ug|GR)\s+([A-Z+\-]+)\s+(\d+\.\d+)/i);
        
        if (match) {
            const code = match[1].toUpperCase() + match[2];
            let grade = match[4].toUpperCase().trim();
            
            // Fix grade OCR errors
            if (grade.length === 2 && grade[0] === grade[1]) {
                grade = grade[0];
            }
            if (grade.length > 2 && !grade.includes('+') && !grade.includes('-')) {
                grade = grade.substring(0, 1);
            }
            if (grade === 'SL' || grade === 'EL') {
                grade = grade[0];
            }
            
            // Validate and filter
            if (!validGrades.includes(grade)) continue;
            if (grade === 'IP' || grade === 'W') continue;
            if (trimmedLine.includes('Repeated') || trimmedLine.includes('Excluded') || trimmedLine.includes('Registered')) continue;
            
            courses[code] = { code, grade };
        }
    }
    
    return courses;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseMultipleScreenshots, extractCoursesFromBannerweb };
}