import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    tinyfish_api_key = os.getenv("TINYFISH_API_KEY", "")
    tinyfish_base_url = os.getenv("TINYFISH_BASE_URL", "https://agent.tinyfish.ai").rstrip("/")

    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

    # LLM provider: "ollama" (local, default), "anthropic", or "none"
    llm_provider = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    ollama_timeout_seconds = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
    llm_model = ollama_model if llm_provider == "ollama" else anthropic_model
    llm_max_items_per_scan = int(os.getenv("LLM_MAX_ITEMS_PER_SCAN", "12"))

    telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "")

    # Optional JSON array of sources to seed on a fresh database. Any education portal works.
    # Example: [{"name": "...", "url": "https://...", "institution": "...", "goal": "..."}]
    seed_sources = os.getenv("SEED_SOURCES", "").strip()
    # Load the bundled sample notices only when explicitly enabled. Off by default so a
    # deployment never looks pre-populated with one institution's data.
    seed_sample_data = _bool("SEED_SAMPLE_DATA", False)

    database_path = str((BASE_DIR / os.getenv("DATABASE_PATH", "./data/noticeradar.db")).resolve())
    data_dir = str((BASE_DIR / "data").resolve())

    scan_interval_minutes = int(os.getenv("SCAN_INTERVAL_MINUTES", "30"))
    watch_interval_seconds = max(15, int(os.getenv("WATCH_INTERVAL_SECONDS", "60")))
    auto_scan_on_change = _bool("AUTO_SCAN_ON_CHANGE", True)
    alert_grace_seconds = max(0, int(os.getenv("ALERT_GRACE_SECONDS", "45")))
    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

    enable_pdf_enrich = _bool("ENABLE_PDF_ENRICH", True)
    enrich_max_items = int(os.getenv("ENRICH_MAX_ITEMS", "2"))
    agent_timeout_seconds = int(os.getenv("AGENT_TIMEOUT_SECONDS", "240"))
    # How long the scan waits for a direct page read before falling back to the agent.
    fast_path_seconds = int(os.getenv("FAST_PATH_SECONDS", "8"))
    enrich_timeout_seconds = int(os.getenv("ENRICH_TIMEOUT_SECONDS", "150"))
    run_scan_on_startup = _bool("RUN_SCAN_ON_STARTUP", False)
    retry_empty_scan = _bool("RETRY_EMPTY_SCAN", True)

    @property
    def llm_configured(self) -> bool:
        if self.llm_provider == "ollama":
            return True
        if self.llm_provider == "anthropic":
            return bool(self.anthropic_api_key)
        return False


settings = Settings()
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
