import json
import logging
from pathlib import Path
from typing import Optional
from pydantic import ValidationError

from lm_client import LMStudioClient
from pdf_extractor import PDFExtractor
from models import SyllabusAnalysis

logger = logging.getLogger(__name__)


class SyllabusProcessor:
    def __init__(self, lm_client: LMStudioClient, prompt_template: str):
        self.lm_client = lm_client
        self.prompt_template = prompt_template
    
    async def process_pdf(self, pdf_path: Path) -> Optional[SyllabusAnalysis]:
        logger.info(f"Processing {pdf_path.name}...")
        
        try:
            syllabus_text = PDFExtractor.extract_text(pdf_path)
            logger.info(f"Extracted {len(syllabus_text)} characters from PDF")
            
            parts = self.prompt_template.split("---", 1)
            system_prompt = parts[0].replace("SYSTEM ROLE:", "").strip()
            
            user_prompt = parts[1] if len(parts) > 1 else self.prompt_template
            user_input = user_prompt.replace("{{SYLLABUS_TEXT}}", syllabus_text).strip()
            
            raw_result = await self.lm_client.extract_syllabus(user_input, system_prompt)
            
            try:
                analysis = SyllabusAnalysis(**raw_result)
                logger.info(f"Successfully processed {pdf_path.name}")
                logger.info(f"Weighted difficulty score: {analysis.weighted_difficulty_score:.2f}")
                return analysis
            except ValidationError as e:
                logger.error(f"Validation error for {pdf_path.name}: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Error processing {pdf_path.name}: {e}")
            return None
    
    def save_result(self, analysis: SyllabusAnalysis, output_path: Path):
        output_path.write_text(
            json.dumps(analysis.model_dump(), indent=2, ensure_ascii=False)
        )
        logger.info(f"Saved result to {output_path}")

