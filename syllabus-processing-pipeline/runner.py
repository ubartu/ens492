#!/usr/bin/env python3
import asyncio
import logging
from pathlib import Path

from lm_client import LMStudioClient
from processor import SyllabusProcessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


LM_STUDIO_URL = "http://localhost:1234/v1"
OUTPUT_DIR = Path("output")
PROMPT_FILE = Path("prompt.txt")

SYLLABUS_PDFS = [
    "math 484 syllabus ver29sep2025.pdf",
    "math 489 syllabus ver24sep2025.pdf",
]


async def main():
    if not PROMPT_FILE.exists():
        logger.error(f"Prompt file not found: {PROMPT_FILE}")
        return
    
    prompt_template = PROMPT_FILE.read_text()
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    lm_client = LMStudioClient(LM_STUDIO_URL)
    processor = SyllabusProcessor(lm_client, prompt_template)
    
    pdfs = [Path(pdf) for pdf in SYLLABUS_PDFS]
    existing_pdfs = [pdf for pdf in pdfs if pdf.exists()]
    
    if not existing_pdfs:
        logger.warning("No PDF files found")
        return
    
    logger.info(f"Found {len(existing_pdfs)} PDF file(s) to process")
    
    tasks = [processor.process_pdf(pdf_file) for pdf_file in existing_pdfs]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful = 0
    failed = 0
    
    for pdf_file, result in zip(existing_pdfs, results):
        if isinstance(result, Exception):
            logger.error(f"Failed to process {pdf_file.name}: {result}")
            failed += 1
        elif result:
            output_file = OUTPUT_DIR / f"{pdf_file.stem}_analysis.json"
            processor.save_result(result, output_file)
            successful += 1
            logger.info(f"✓ Saved: {output_file}")
        else:
            failed += 1
    
    logger.info(f"\n{'='*60}")
    logger.info(f"Processing complete: {successful} successful, {failed} failed")
    logger.info(f"Output directory: {OUTPUT_DIR.absolute()}")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())

