import logging
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.github.auth import get_installation_token

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubClient:
    """Client for interacting with GitHub REST API with installation auth and pagination."""

    def __init__(self, installation_id: int):
        self.installation_id = installation_id

    async def get_headers(self) -> Dict[str, str]:
        token = await get_installation_token(self.installation_id)
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def fetch_pr_files(self, owner: str, repo: str, pull_number: int) -> List[Dict[str, Any]]:
        """
        Fetches all changed files for a pull request, handling pagination up to 3000 files.
        """
        all_files: List[Dict[str, Any]] = []
        page = 1
        per_page = 100
        max_pages = 30  # 30 * 100 = 3000 files cap

        headers = await self.get_headers()

        async with httpx.AsyncClient(timeout=20.0) as client:
            while page <= max_pages:
                url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pull_number}/files?per_page={per_page}&page={page}"
                response = await client.get(url, headers=headers)

                if response.status_code == 403 and "secondary rate limit" in response.text.lower():
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"GitHub secondary rate limit reached. Retry-After: {retry_after}s")
                    break

                response.raise_for_status()
                files_batch = response.json()

                if not files_batch:
                    break

                all_files.extend(files_batch)

                if len(files_batch) < per_page:
                    break

                page += 1

        logger.info(f"Fetched {len(all_files)} files for {owner}/{repo} PR #{pull_number}")
        return all_files
