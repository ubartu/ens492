"""
BannerWeb Course Scraper for Sabancı University
Scrapes course data from SUIS BannerWeb and outputs in clean JSON format.
Can be run daily as a scheduled task.

Usage:
    python bannerweb_scraper.py 202502  # For Spring 2025
    python bannerweb_scraper.py 202501  # For Fall 2024
"""

import requests
import json
import sys
import re
import time
from typing import List, Dict, Optional
from datetime import datetime
from bs4 import BeautifulSoup


class BannerWebScraper:
    """Scrapes course data from Sabancı University BannerWeb"""
    
    BASE_URL = "https://suis.sabanciuniv.edu/prod"
    
    # Day mapping (from BannerWeb codes to readable names)
    DAY_MAP = {
        "M": "Monday",
        "T": "Tuesday", 
        "W": "Wednesday",
        "R": "Thursday",
        "F": "Friday",
        "S": "Saturday",
        "U": "Sunday"
    }
    
    # Time slots mapping (BannerWeb uses specific time slots)
    TIME_SLOTS = {
        '8:40 am': '08:40', '9:40 am': '09:40', '10:40 am': '10:40',
        '11:40 am': '11:40', '12:40 pm': '12:40', '1:40 pm': '13:40',
        '2:40 pm': '14:40', '3:40 pm': '15:40', '4:40 pm': '16:40',
        '5:40 pm': '17:40', '6:40 pm': '18:40', '7:40 pm': '19:40',
        '8:00 am': '08:00', '9:00 am': '09:00', '10:00 am': '10:00',
        '11:00 am': '11:00', '12:00 pm': '12:00', '1:00 pm': '13:00',
        '2:00 pm': '14:00', '3:00 pm': '15:00', '4:00 pm': '16:00',
        '5:00 pm': '17:00', '6:00 pm': '18:00', '7:00 pm': '19:00',
        '9:30 am': '09:30', '10:30 am': '10:30', '11:30 am': '11:30',
        '12:30 pm': '12:30', '1:30 pm': '13:30', '2:30 pm': '14:30',
        '3:30 pm': '15:30', '4:30 pm': '16:30', '5:30 pm': '17:30',
        '6:30 pm': '18:30', '7:30 pm': '19:30', '8:30 pm': '20:30',
        '10:15 am': '10:15', '11:15 am': '11:15', '12:15 pm': '12:15',
        '1:15 pm': '13:15', '2:15 pm': '14:15', '3:15 pm': '15:15',
        '4:15 pm': '16:15', '5:15 pm': '17:15', '6:15 pm': '18:15',
        '7:15 pm': '19:15', '8:15 pm': '20:15'
    }
    
    def __init__(self, term: int, verbose: bool = True):
        """
        Initialize scraper for a specific term.
        
        Args:
            term: Term code (e.g., 202502 for Spring 2025)
            verbose: Print progress messages
        """
        self.term = term
        self.verbose = verbose
        self.session = requests.Session()
        
    def log(self, message: str):
        """Print log message if verbose mode is enabled"""
        if self.verbose:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"[{timestamp}] {message}")
    
    def get_course_codes(self) -> List[str]:
        """
        Fetch all available course subject codes from BannerWeb.
        
        Returns:
            List of subject codes (e.g., ['CS', 'MATH', 'ECON', ...])
        """
        self.log("Fetching course codes from BannerWeb...")
        
        url = f"{self.BASE_URL}/bwckgens.p_proc_term_date"
        payload = {
            'p_calling_proc': 'bwckschd.p_disp_dyn_sched',
            'p_term': self.term
        }
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        
        try:
            response = self.session.post(url, data=payload, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            course_codes = [
                option.get('value') 
                for option in soup.find_all('option')
                if option.get('value') and 
                   option.get('value').isupper() and 
                   option.get('value').isalpha()
            ]
            
            self.log(f"Found {len(course_codes)} subject codes")
            return course_codes
            
        except requests.RequestException as e:
            self.log(f"Error fetching course codes: {e}")
            return []
    
    def get_all_courses_html(self, course_codes: List[str]) -> str:
        """
        Fetch HTML page containing all courses for the given subject codes.
        
        Args:
            course_codes: List of subject codes to fetch
            
        Returns:
            HTML content as string
        """
        self.log(f"Fetching course data for {len(course_codes)} subjects...")
        
        # Add dummy value at beginning (required by BannerWeb)
        codes = ['dummy'] + course_codes
        
        url = f"{self.BASE_URL}/bwckschd.p_get_crse_unsec"
        payload = {
            'term_in': self.term,
            'sel_subj': codes,
            'sel_day': 'dummy',
            'sel_schd': 'dummy',
            'sel_insm': 'dummy',
            'sel_camp': 'dummy',
            'sel_levl': 'dummy',
            'sel_sess': 'dummy',
            'sel_instr': 'dummy',
            'sel_ptrm': 'dummy',
            'sel_attr': 'dummy',
            'sel_crse': '',
            'sel_title': '',
            'sel_from_cred': '',
            'sel_to_cred': '',
            'begin_hh': '0',
            'begin_mi': '0',
            'begin_ap': 'a',
            'end_hh': '0',
            'end_mi': '0',
            'end_ap': 'a'
        }
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        
        try:
            response = self.session.post(url, data=payload, headers=headers, timeout=60)
            response.raise_for_status()
            return response.text
            
        except requests.RequestException as e:
            self.log(f"Error fetching course data: {e}")
            return ""
    
    def get_course_attributes(self, subject_code: str, class_number: str) -> Dict:
        """
        Fetch course attributes (Engineering/Basic Science credits) from catalog page.
        
        Args:
            subject_code: Subject code (e.g., "CS")
            class_number: Class number (e.g., "201")
            
        Returns:
            Dict with engineering_credits and basic_science_credits
        """
        url = f"{self.BASE_URL}/bwckctlg.p_disp_course_detail"
        params = {
            'cat_term_in': self.term,
            'subj_code_in': subject_code,
            'crse_numb_in': class_number
        }
        
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find the table with course attributes
            tables = soup.find_all('table', class_='datadisplaytable')
            
            for table in tables:
                text = table.get_text()
                
                # Look for pattern: (ENGINEERING:X / BASIC:Y)
                match = re.search(r'ENGINEERING:(\d+)\s*/\s*BASIC:(\d+)', text)
                if match:
                    return {
                        'engineering_credits': int(match.group(1)),
                        'basic_science_credits': int(match.group(2))
                    }
            
            # If not found, return zeros
            return {
                'engineering_credits': 0,
                'basic_science_credits': 0
            }
            
        except Exception as e:
            self.log(f"Error fetching attributes for {subject_code}{class_number}: {e}")
            return {
                'engineering_credits': 0,
                'basic_science_credits': 0
            }
    
    def parse_courses(self, html: str) -> List[Dict]:
        """
        Parse HTML and extract course information in the desired format.
        
        Args:
            html: HTML content from BannerWeb
            
        Returns:
            List of courses in the format:
            [
              {
                "subject_code": "CS",
                "class_number": "101",
                "engineering_credits": 6,
                "basic_science_credits": 0,
                "sections": [
                  {
                    "section": "01",
                    "instructor": "Prof Name",
                    "schedule": [
                      {
                        "day": "Monday",
                        "start_time": "09:40",
                        "end_time": "10:30",
                        "location": "FENS L035"
                      }
                    ]
                  }
                ]
              }
            ]
        """
        self.log("Parsing course data...")
        
        soup = BeautifulSoup(html, 'html.parser')
        courses_dict = {}  # Use dict to group sections by course code
        
        # Find all course headers
        course_headers = soup.find_all("th", class_="ddlabel")
        self.log(f"Found {len(course_headers)} course sections")
        
        for header in course_headers:
            try:
                # Parse course header
                # Format: "Course Title - CRN - SUBJ CODE - Section"
                header_text = header.get_text(strip=True)
                parts = header_text.split(' - ')
                
                if len(parts) < 4:
                    continue
                
                course_title = parts[0].strip()
                crn = parts[1].strip()
                course_code = parts[2].strip()
                section_code = parts[3].strip()
                
                # Extract subject code and class number
                # e.g., "CS 101" -> subject_code="CS", class_number="101"
                code_match = re.match(r'^([A-Z]+)\s*(\d+[A-Z]?)$', course_code)
                if not code_match:
                    continue
                
                subject_code = code_match.group(1)
                class_number = code_match.group(2)
                
                # Get schedule table for this course
                schedule_data = self._extract_schedule(header)
                
                # Create course key
                course_key = f"{subject_code}{class_number}"
                
                # Initialize course if not exists
                if course_key not in courses_dict:
                    courses_dict[course_key] = {
                        "subject_code": subject_code,
                        "class_number": class_number,
                        "sections": [],
                        "attributes_fetched": False  # Track if we've fetched attributes
                    }
                
                # Add section
                courses_dict[course_key]["sections"].append({
                    "section": section_code,
                    "instructor": schedule_data["instructor"],
                    "schedule": schedule_data["schedule"]
                })
                
            except Exception as e:
                self.log(f"Error parsing course: {e}")
                continue
        
        # Convert dict to list
        courses = list(courses_dict.values())
        self.log(f"Parsed {len(courses)} unique courses")
        
        # Fetch attributes for each course
        self.log("Fetching course attributes (Engineering/Basic Science credits)...")
        for i, course in enumerate(courses, 1):
            if self.verbose and i % 10 == 0:
                self.log(f"Fetched attributes for {i}/{len(courses)} courses...")
            
            attributes = self.get_course_attributes(
                course['subject_code'],
                course['class_number']
            )
            
            course['engineering_credits'] = attributes['engineering_credits']
            course['basic_science_credits'] = attributes['basic_science_credits']
            
            # Remove the tracking flag
            if 'attributes_fetched' in course:
                del course['attributes_fetched']
            
            # Small delay to be respectful to the server
            time.sleep(0.1)
        
        self.log(f"Completed attribute fetching for all courses")
        
        return courses
    
    def _extract_schedule(self, course_header) -> Dict:
        """
        Extract schedule information from course header's sibling table.
        
        Args:
            course_header: BeautifulSoup element containing course header
            
        Returns:
            Dict with instructor and schedule list
        """
        instructor = None
        schedule = []
        
        # Find the table with schedule information
        next_row = course_header.parent.find_next_sibling("tr")
        if not next_row:
            return {"instructor": instructor, "schedule": schedule}
        
        table = next_row.find("table", class_="datadisplaytable")
        if not table:
            return {"instructor": instructor, "schedule": schedule}
        
        # Parse schedule rows
        rows = table.find_all("tr")[1:]  # Skip header row
        
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 7:
                continue
            
            # Extract data from cells
            # 0: Type, 1: Time, 2: Days, 3: Location, 4: Date Range, 
            # 5: Schedule Type, 6: Instructors
            
            time_str = cells[1].get_text(strip=True)
            days_str = cells[2].get_text(strip=True)
            location_str = cells[3].get_text(strip=True)
            instructor_str = cells[6].get_text(strip=True)
            
            # Get instructor (use first non-TBA instructor found)
            if instructor_str and instructor_str != "TBA" and not instructor:
                instructor = self._clean_instructor_name(instructor_str)
            
            # Parse time
            if time_str and time_str != "TBA":
                start_time, end_time = self._parse_time(time_str)
            else:
                continue
            
            # Parse days and create schedule entries
            if days_str and days_str != "TBA":
                for day_code in days_str:
                    if day_code in self.DAY_MAP:
                        schedule.append({
                            "day": self.DAY_MAP[day_code],
                            "start_time": start_time,
                            "end_time": end_time,
                            "location": self._clean_location(location_str)
                        })
        
        return {
            "instructor": instructor,
            "schedule": schedule if schedule else None
        }
    
    def _parse_time(self, time_str: str) -> tuple:
        """
        Parse time string from BannerWeb format.
        
        Args:
            time_str: Time string like "9:40 am - 10:30 am"
            
        Returns:
            Tuple of (start_time, end_time) in 24-hour format
        """
        try:
            parts = time_str.split(' - ')
            if len(parts) != 2:
                return None, None
            
            start = parts[0].strip()
            end = parts[1].strip()
            
            # Convert using mapping
            start_24 = self.TIME_SLOTS.get(start, start)
            end_24 = self.TIME_SLOTS.get(end, end)
            
            return start_24, end_24
            
        except Exception:
            return None, None
    
    def _clean_instructor_name(self, name: str) -> str:
        """Clean instructor name by removing extra spaces"""
        return ' '.join(name.split())
    
    def _clean_location(self, location: str) -> str:
        """
        Clean and standardize location names.
        
        Args:
            location: Raw location string
            
        Returns:
            Cleaned location string
        """
        location = location.strip()
        
        # Replace long names with abbreviations
        replacements = {
            "Fac.of Arts and Social Sci.": "FASS",
            "Fac. of Arts and Social Sci.": "FASS",
            "Faculty of Arts and Social Sciences": "FASS",
            "Sabancı Business School": "FMAN",
            "Sabanci Business School": "FMAN",
            "Fac. of Engin. and Nat. Sci.": "FENS",
            "Fac.of Engin. and Nat. Sci.": "FENS",
            "Faculty of Engineering and Natural Sciences": "FENS",
            "School of Languages Building": "SL",
            "School of Languages": "SL",
            "University Center": "UC"
        }
        
        for old, new in replacements.items():
            location = location.replace(old, new)
        
        return location
    
    def save_to_json(self, courses: List[Dict], filename: str = "courses.json"):
        """
        Save courses to JSON file.
        
        Args:
            courses: List of course dictionaries
            filename: Output filename
        """
        self.log(f"Saving {len(courses)} courses to {filename}...")
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(courses, f, indent=2, ensure_ascii=False)
            
            self.log(f"Successfully saved to {filename}")
            
        except Exception as e:
            self.log(f"Error saving to file: {e}")
    
    def run(self, output_file: str = "courses.json"):
        """
        Run the complete scraping process.
        
        Args:
            output_file: Path to output JSON file
            
        Returns:
            List of courses
        """
        self.log(f"Starting scrape for term {self.term}")
        
        # Step 1: Get course codes
        course_codes = self.get_course_codes()
        if not course_codes:
            self.log("No course codes found. Aborting.")
            return []
        
        # Step 2: Fetch all courses HTML
        html = self.get_all_courses_html(course_codes)
        if not html:
            self.log("No HTML content received. Aborting.")
            return []
        
        # Step 3: Parse courses
        courses = self.parse_courses(html)
        
        # Step 4: Save to file
        if courses:
            self.save_to_json(courses, output_file)
        else:
            self.log("No courses parsed.")
        
        self.log("Scraping complete!")
        return courses


def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 2:
        print("Usage: python bannerweb_scraper.py <term_code>")
        print("Example: python bannerweb_scraper.py 202502")
        print("\nTerm codes:")
        print("  202501 = Fall 2024")
        print("  202502 = Spring 2025")
        print("  202503 = Summer 2025")
        sys.exit(1)
    
    term = int(sys.argv[1])
    output_file = sys.argv[2] if len(sys.argv) > 2 else "courses.json"
    
    scraper = BannerWebScraper(term=term, verbose=True)
    courses = scraper.run(output_file=output_file)
    
    if courses:
        print(f"\n✅ Successfully scraped {len(courses)} courses")
        print(f"📁 Output saved to: {output_file}")
        
        # Show sample
        if len(courses) > 0:
            print(f"\n📋 Sample course:")
            print(json.dumps(courses[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()