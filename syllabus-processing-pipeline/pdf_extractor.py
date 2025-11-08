import logging
from pathlib import Path
import pdfplumber

logger = logging.getLogger(__name__)


class PDFExtractor:
    @staticmethod
    def extract_text(pdf_path: Path) -> str:
        text_parts = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
        except Exception as e:
            logger.error(f"Error extracting PDF {pdf_path}: {e}")
            raise
        
        return "\n\n".join(text_parts)

