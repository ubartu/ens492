import json
import logging
import re
from typing import Dict, Any
import aiohttp

logger = logging.getLogger(__name__)


class LMStudioClient:
    def __init__(self, base_url: str = "http://localhost:1234/v1"):
        self.base_url = base_url
        self.chat_endpoint = f"{base_url}/chat/completions"
    
    async def extract_syllabus(self, syllabus_text: str, system_prompt: str) -> Dict[str, Any]:
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": "local-model",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": syllabus_text}
                ],
                "temperature": 0.1,
                "max_tokens": 2000
            }
            
            try:
                async with session.post(self.chat_endpoint, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"LM Studio API error {response.status}: {error_text}")
                    
                    result = await response.json()
                    content = result["choices"][0]["message"]["content"].strip()
                    
                    if content.startswith("```json"):
                        content = content.replace("```json", "").replace("```", "").strip()
                    elif content.startswith("```"):
                        content = content.replace("```", "").strip()
                    
                    json_match = re.search(r'\{[\s\S]*\}', content)
                    if json_match:
                        json_str = json_match.group()
                        try:
                            return json.loads(json_str)
                        except json.JSONDecodeError as e:
                            logger.debug(f"JSON parse error: {e}")
                            
                            json_str = re.sub(r',\s*}', '}', json_str)
                            json_str = re.sub(r',\s*]', ']', json_str)
                            
                            while True:
                                fixed = re.sub(
                                    r':\s*"([^"]*)",\s*"([^"]*)"', 
                                    r': "\1 \2"',
                                    json_str,
                                    count=1
                                )
                                if fixed == json_str:
                                    break
                                json_str = fixed
                            
                            try:
                                return json.loads(json_str)
                            except json.JSONDecodeError:
                                with open("debug_response.txt", "w") as f:
                                    f.write(content)
                                logger.error("Saved problematic response to debug_response.txt")
                                raise
                    else:
                        raise ValueError("No JSON found in response")
            except Exception as e:
                logger.error(f"Error calling LM Studio: {e}")
                raise

