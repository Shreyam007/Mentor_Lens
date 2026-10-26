import hashlib
import logging
import math
import os
import re
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "mentorlens_commits_v1"


def compute_text_embedding_vector(text: str, dim: int = 64) -> List[float]:
    """
    Lightweight deterministic token frequency vector for fallback embedding
    when external embedding providers or local transformer models are unavailable.
    Normalized to unit length for cosine similarity.
    """
    words = re.findall(r"\w+", text.lower())
    vec = [0.0] * dim
    for word in words:
        # Hash token to dimension slot
        idx = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16) % dim
        vec[idx] += 1.0

    magnitude = math.sqrt(sum(x * x for x in vec))
    if magnitude > 0:
        vec = [x / magnitude for x in vec]
    return vec


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    return max(0.0, min(1.0, dot))


class TeamMemoryStore:
    """
    Team memory vector store backed by ChromaDB with an in-memory/disk fallback.
    Supports versioned collections, idempotent upserts, and stale commit marking.
    """

    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or settings.CHROMA_PERSIST_DIRECTORY
        self._chroma_client = None
        self._collection = None
        # In-memory fallback index: id -> item
        self._fallback_index: Dict[str, Dict[str, Any]] = {}

        self._init_client()

    def _init_client(self):
        try:
            import chromadb
            if settings.CHROMA_HOST:
                self._chroma_client = chromadb.HttpClient(
                    host=settings.CHROMA_HOST,
                    port=settings.CHROMA_PORT,
                )
            else:
                os.makedirs(self.persist_dir, exist_ok=True)
                self._chroma_client = chromadb.PersistentClient(path=self.persist_dir)

            self._collection = self._chroma_client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("ChromaDB vector store connected successfully.")
        except Exception as e:
            logger.warning(f"ChromaDB unavailable ({e}), utilizing local fallback vector store.")
            self._chroma_client = None
            self._collection = None

    def upsert_chunk(
        self,
        repo_id: str,
        sha: str,
        file: str,
        function: str,
        category: str,
        snippet: str,
        commit_message: str,
        author: str,
        committed_at: str,
        is_stale: bool = False,
    ) -> str:
        """
        Idempotent upsert keyed by (repo_id, sha, file, function).
        """
        chunk_id = f"{repo_id}:{sha}:{file}:{function}"
        metadata = {
            "repo_id": repo_id,
            "sha": sha,
            "file": file,
            "function": function,
            "category": category,
            "commit_message": commit_message,
            "author": author,
            "committed_at": committed_at,
            "is_stale": str(is_stale).lower(),
        }

        # ChromaDB upsert
        if self._collection is not None:
            try:
                self._collection.upsert(
                    ids=[chunk_id],
                    documents=[snippet],
                    metadatas=[metadata],
                )
            except Exception as e:
                logger.warning(f"Chroma upsert failed: {e}")

        # Always update fallback index
        embedding = compute_text_embedding_vector(f"{snippet} {commit_message}")
        self._fallback_index[chunk_id] = {
            "id": chunk_id,
            "document": snippet,
            "metadata": metadata,
            "embedding": embedding,
        }

        return chunk_id

    def search_similar(
        self,
        repo_id: str,
        query: str,
        top_k: int = 5,
        min_similarity: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Searches team memory for similar past bug-fix commits within the given repo.
        Returns top-k items that pass the similarity threshold and are not stale.
        """
        results: List[Dict[str, Any]] = []

        if self._collection is not None:
            try:
                query_res = self._collection.query(
                    query_texts=[query],
                    n_results=top_k * 2,
                    where={"repo_id": repo_id},
                )
                if query_res and query_res["ids"] and query_res["ids"][0]:
                    ids = query_res["ids"][0]
                    docs = query_res["documents"][0]
                    metas = query_res["metadatas"][0]
                    distances = query_res.get("distances", [[]])[0]

                    for doc_id, doc, meta, dist in zip(ids, docs, metas, distances):
                        # Cosine distance to similarity: similarity = 1 - distance
                        sim = 1.0 - (dist if dist is not None else 0.5)
                        if meta.get("is_stale") == "true":
                            continue
                        if sim >= min_similarity:
                            results.append({
                                "id": doc_id,
                                "sha": meta.get("sha"),
                                "file": meta.get("file"),
                                "function": meta.get("function"),
                                "category": meta.get("category"),
                                "commit_message": meta.get("commit_message"),
                                "author": meta.get("author"),
                                "committed_at": meta.get("committed_at"),
                                "diff_snippet": doc,
                                "similarity": round(sim, 3),
                            })
                    if results:
                        return results[:top_k]
            except Exception as e:
                logger.warning(f"Chroma query failed ({e}), falling back to internal index.")

        # Fallback search
        query_vec = compute_text_embedding_vector(query)
        candidates = []

        for item in self._fallback_index.values():
            meta = item["metadata"]
            if meta.get("repo_id") != repo_id:
                continue
            if meta.get("is_stale") == "true":
                continue

            sim = cosine_similarity(query_vec, item["embedding"])
            if sim >= min_similarity:
                candidates.append({
                    "id": item["id"],
                    "sha": meta.get("sha"),
                    "file": meta.get("file"),
                    "function": meta.get("function"),
                    "category": meta.get("category"),
                    "commit_message": meta.get("commit_message"),
                    "author": meta.get("author"),
                    "committed_at": meta.get("committed_at"),
                    "diff_snippet": item["document"],
                    "similarity": round(sim, 3),
                })

        candidates.sort(key=lambda x: x["similarity"], reverse=True)
        return candidates[:top_k]

    def mark_stale(self, repo_id: str, shas: List[str]) -> int:
        """Marks specified commit SHAs as stale (e.g. following history rewrite)."""
        count = 0
        sha_set = set(shas)
        for chunk_id, item in self._fallback_index.items():
            meta = item["metadata"]
            if meta.get("repo_id") == repo_id and meta.get("sha") in sha_set:
                meta["is_stale"] = "true"
                count += 1
                if self._collection is not None:
                    try:
                        self._collection.update(ids=[chunk_id], metadatas=[meta])
                    except Exception:
                        pass
        return count

    def delete_repo_data(self, repo_id: str) -> None:
        """Deletes all chunks belonging to a repository."""
        to_del = [k for k, v in self._fallback_index.items() if v["metadata"].get("repo_id") == repo_id]
        for k in to_del:
            del self._fallback_index[k]
        if self._collection is not None and to_del:
            try:
                self._collection.delete(ids=to_del)
            except Exception:
                pass


# Global singleton instance
memory_store = TeamMemoryStore()
