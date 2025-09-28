# app/services/connectors.py
import os, json, logging
from typing import Dict, Any, List
from langchain_core.documents import Document
from langchain_community.document_loaders import (
    DirectoryLoader, TextLoader, PyPDFLoader, CSVLoader, WebBaseLoader,
    NotionDBLoader, GoogleDriveLoader,
)
from langchain_community.document_loaders import Docx2txtLoader, UnstructuredExcelLoader
from notion_client import Client as NotionClient
# --- logging ---------------------------------------------------------------
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL)
logger = logging.getLogger("chronos.connectors")
# --------------------------------------------------------------------------

CONFIG_DIR = "app/data"
CONFIG_PATH = os.path.join(CONFIG_DIR, "connectors.json")

DEFAULT_CONFIG = {
    "local": {"enabled": True, "path": "app/data/docs"},
    "urls":  {"enabled": False, "list": ["https://www.example.com"]},
    "notion": {"enabled": False, "integration_token": "", "database_id": ""},
    "gdrive": {"enabled": False, "folder_id": "", "service_account_json": ""},
    "m365":   {"enabled": False, "site_id": "", "drive_id": "",
               "client_id": "", "tenant_id": "", "client_secret": ""}
}

def _ensure():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=2)

def load_config() -> Dict[str, Any]:
    _ensure()
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    logger.debug("[CONFIG] loaded: %s", cfg)
    return cfg

def save_config(cfg: Dict[str, Any]):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    logger.info("[CONFIG] saved %s", CONFIG_PATH)

def list_connectors() -> Dict[str, Any]:
    return load_config()

def update_connector(name: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    cfg = load_config()
    if name not in cfg:
        raise ValueError(f"connector '{name}' not found")
    cfg[name].update(patch)
    save_config(cfg)
    logger.info("[CONFIG] updated connector '%s' with %s", name, patch)
    return cfg[name]

# ------------------------- Local ------------------------------------------
def _iter_local_docs(path: str) -> List[Document]:
    if not path or not os.path.exists(path):
        logger.warning("[LOCAL] path not found: %s", path)
        return []

    docs: List[Document] = []
    patterns = [
        ("**/*.md",   TextLoader, {"encoding": "utf-8", "autodetect_encoding": True}),
        ("**/*.txt",  TextLoader, {"encoding": "utf-8", "autodetect_encoding": True}),
        ("**/*.pdf",  PyPDFLoader, {}),
        ("**/*.csv",  CSVLoader, {}),
        ("**/*.docx", Docx2txtLoader, {}),
        ("**/*.xlsx", UnstructuredExcelLoader, {"mode": "elements"}),
    ]
    total_before = 0
    for pattern, loader_cls, loader_kwargs in patterns:
        try:
            loader = DirectoryLoader(
                path, glob=pattern, loader_cls=loader_cls,
                loader_kwargs=loader_kwargs, show_progress=True,
                use_multithreading=True
            )
            loaded = loader.load()
            docs.extend(loaded)
            logger.info("[LOCAL] pattern=%s -> %d docs", pattern, len(loaded))
            total_before += len(loaded)
        except Exception as e:
            logger.exception("[LOCAL] fail pattern=%s: %s", pattern, e)

    for d in docs:
        src = d.metadata.get("source") or d.metadata.get("file_path") or "local"
        d.metadata["source"] = str(src).replace("\\", "/")
        d.metadata.setdefault("connector", "local")
        if "page" not in d.metadata and "page_number" in d.metadata:
            d.metadata["page"] = d.metadata["page_number"]

    logger.info("[LOCAL] total docs: %d", len(docs))
    return docs

# ------------------------- URLs -------------------------------------------
def _iter_url_docs(urls: List[str]) -> List[Document]:
    urls = [u for u in (urls or []) if isinstance(u, str) and u.strip()]
    if not urls:
        return []
    user_agent = os.getenv("USER_AGENT", "chronos-bemobi/0.1 (+https://bemobi.com)")
    header_template = {"User-Agent": user_agent}

    try:
        loader = WebBaseLoader(urls, header_template=header_template)
        docs = loader.load()
        for d in docs:
            d.metadata.setdefault("connector", "urls")
            src = d.metadata.get("source") or d.metadata.get("url") or "url"
            d.metadata["source"] = str(src)
            if "page" not in d.metadata and "page_number" in d.metadata:
                d.metadata["page"] = d.metadata["page_number"]
        logger.info("[URLS] fetched urls=%d -> %d docs", len(urls), len(docs))
        return docs
    except Exception as e:
        logger.exception("[CONNECTOR][URLS] error: %s", e)
        return []

# ------------------------- Notion -----------------------------------------

# --- cole este helper perto do topo do arquivo (abaixo dos imports) ---
def _extract_notion_text_from_property(prop_val):
    """
    Extrai texto legível de diferentes tipos de propriedade do Notion.
    Funciona para title, rich_text, select, multi_select, date etc.
    """
    try:
        # Já veio como string
        if isinstance(prop_val, str):
            return prop_val

        # Dict no formato da API do Notion
        if isinstance(prop_val, dict):
            t = prop_val.get("type")
            if t == "title":
                arr = prop_val.get("title", [])
                return "".join([x.get("plain_text", "") for x in arr])
            if t == "rich_text":
                arr = prop_val.get("rich_text", [])
                return "".join([x.get("plain_text", "") for x in arr])
            if t == "select":
                sel = prop_val.get("select")
                if isinstance(sel, dict):
                    return sel.get("name", "") or ""
            if t == "multi_select":
                arr = prop_val.get("multi_select", [])
                return ", ".join([x.get("name", "") for x in arr if isinstance(x, dict)])
            if t == "date":
                d = prop_val.get("date", {})
                start = d.get("start") or ""
                end = d.get("end") or ""
                return f"{start}{' – ' + end if end else ''}"

        # Lista de fragmentos com plain_text
        if isinstance(prop_val, list):
            parts = []
            for x in prop_val:
                if isinstance(x, dict) and "plain_text" in x:
                    parts.append(x["plain_text"])
                else:
                    parts.append(str(x))
            return " ".join(parts)

        return str(prop_val)
    except Exception:
        return str(prop_val)


def _iter_notion_docs(notion_cfg: Dict[str, Any]) -> List[Document]:
    """
    Lê um database do Notion via API oficial, converte propriedades padrão e
    monta o page_content manualmente. Evita o 'None' que aparece no NotionDBLoader.
    Requer:
      - integration_token (NOTION_API_KEY no .env ou aqui)
      - database_id
    Colunas esperadas (case-sensitive): Name (title), Content (rich_text),
    Category (select), Tags (multi_select), LastUpdated (date).
    """
    token = notion_cfg.get("integration_token") or os.getenv("NOTION_API_KEY")
    database_id = notion_cfg.get("database_id")
    if not token or not database_id:
        logger.warning("[NOTION] missing token or database_id")
        return []

    client = NotionClient(auth=token)
    docs: List[Document] = []

    try:
        # paginação simples (até 100 registros por chamada)
        cursor = None
        while True:
            resp = client.databases.query(
                database_id=database_id,
                start_cursor=cursor,
                page_size=100
            )
            results = resp.get("results", [])

            for page in results:
                props = page.get("properties", {})

                def get_title(p: Dict[str, Any]) -> str:
                    if not p or p.get("type") != "title":
                        return ""
                    return "".join([t.get("plain_text", "") for t in p.get("title", [])])

                def get_rich(p: Dict[str, Any]) -> str:
                    if not p or p.get("type") != "rich_text":
                        return ""
                    return "".join([t.get("plain_text", "") for t in p.get("rich_text", [])])

                def get_select(p: Dict[str, Any]) -> str:
                    if not p or p.get("type") != "select":
                        return ""
                    sel = p.get("select")
                    return sel.get("name", "") if sel else ""

                def get_multiselect(p: Dict[str, Any]) -> str:
                    if not p or p.get("type") != "multi_select":
                        return ""
                    return ", ".join([o.get("name", "") for o in p.get("multi_select", [])])

                def get_date(p: Dict[str, Any]) -> str:
                    if not p or p.get("type") != "date":
                        return ""
                    d = p.get("date")
                    return (d.get("start") or "") if d else ""

                name        = get_title(props.get("Name", {}))
                content     = get_rich(props.get("Content", {}))
                category    = get_select(props.get("Category", {}))
                tags        = get_multiselect(props.get("Tags", {}))
                lastupdate  = get_date(props.get("LastUpdated", {}))

                # monte um texto amigável ao RAG
                text = (
                    f"Name: {name}\n"
                    f"Category: {category}\n"
                    f"Tags: {tags}\n"
                    f"LastUpdated: {lastupdate}\n\n"
                    f"Content:\n{content}"
                ).strip()

                metadata = {
                    "connector": "notion",
                    "source": f"notion://{database_id}",
                    "notion_page_id": page.get("id"),
                    "title": name,
                    "category": category,
                    "tags": tags,
                    "lastupdated": lastupdate,
                }

                docs.append(Document(page_content=text, metadata=metadata))

            if resp.get("has_more"):
                cursor = resp.get("next_cursor")
            else:
                break

        logger.info("[NOTION] loaded %d docs (via notion_client) database_id=%s", len(docs), database_id)
        # debug: primeiros 3 títulos/trechos
        for i, d in enumerate(docs[:3]):
            logger.info("[NOTION] sample %d | title=%s | text=%s",
                        i+1, d.metadata.get("title"), (d.page_content[:120] + "..."))

        return docs

    except Exception as e:
        logger.exception("[CONNECTOR][NOTION] error: %s", e)
        return []


# ------------------------- Google Drive -----------------------------------
def _iter_gdrive_docs(gdrive_cfg: Dict[str, Any]) -> List[Document]:
    folder_id = gdrive_cfg.get("folder_id")
    sa_json = gdrive_cfg.get("service_account_json") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not folder_id or not sa_json or not os.path.exists(sa_json):
        logger.warning("[GDRIVE] missing folder_id or service_account_json")
        return []

    try:
        loader = GoogleDriveLoader(
            folder_id=folder_id,
            service_account_key_path=sa_json,
            recursive=True,
        )
        docs = loader.load()
        for d in docs:
            d.metadata.setdefault("connector", "gdrive")
            src = d.metadata.get("source") or d.metadata.get("file_path") or f"gdrive://{folder_id}"
            d.metadata["source"] = str(src).replace("\\", "/")
            if "page" not in d.metadata and "page_number" in d.metadata:
                d.metadata["page"] = d.metadata["page_number"]
        logger.info("[GDRIVE] folder=%s -> %d docs", folder_id, len(docs))
        return docs
    except Exception as e:
        logger.exception("[CONNECTOR][GDRIVE] error: %s", e)
        return []

def _iter_m365_docs(_: Dict[str, Any]) -> List[Document]:
    # TODO: Microsoft Graph (SharePoint/OneDrive)
    return []

# ------------------------- Orquestrador -----------------------------------
def collect_documents() -> List[Document]:
    cfg = load_config()
    out: List[Document] = []
    summary = {}

    if cfg.get("local", {}).get("enabled"):
        loc = _iter_local_docs(cfg["local"].get("path", "app/data/docs"))
        out.extend(loc); summary["local"] = len(loc)
    if cfg.get("urls", {}).get("enabled"):
        url_docs = _iter_url_docs(cfg["urls"].get("list", []))
        out.extend(url_docs); summary["urls"] = len(url_docs)
    if cfg.get("notion", {}).get("enabled"):
        not_docs = _iter_notion_docs(cfg["notion"])
        out.extend(not_docs); summary["notion"] = len(not_docs)
    if cfg.get("gdrive", {}).get("enabled"):
        gd = _iter_gdrive_docs(cfg["gdrive"])
        out.extend(gd); summary["gdrive"] = len(gd)
    if cfg.get("m365", {}).get("enabled"):
        m = _iter_m365_docs(cfg["m365"])
        out.extend(m); summary["m365"] = len(m)

    logger.info("[COLLECT] summary: %s | total=%d", summary, len(out))
    return out
