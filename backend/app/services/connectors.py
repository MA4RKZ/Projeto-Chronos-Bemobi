import os, json
from typing import Dict, Any, List
from langchain_core.documents import Document
from langchain_community.document_loaders import (
    DirectoryLoader, TextLoader, PyPDFLoader, CSVLoader, WebBaseLoader
)
from langchain_community.document_loaders import Docx2txtLoader, UnstructuredExcelLoader

CONFIG_DIR = "app/data"
CONFIG_PATH = os.path.join(CONFIG_DIR, "connectors.json")

DEFAULT_CONFIG = {
    "local": {"enabled": True, "path": "app/data/docs"},
    "urls":  {"enabled": False, "list": ["https://www.example.com"]},
    "notion": {
        "enabled": False,
        "integration_token": "",
        "database_id": ""
    },
    "gdrive": {
        "enabled": False,
        "folder_id": "",
        "service_account_json": ""
    },
    "m365": {
        "enabled": False,
        "site_id": "",
        "drive_id": "",
        "client_id": "",
        "tenant_id": "",
        "client_secret": ""
    }
}

def _ensure():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, ensure_ascii=False, indent=2)

def load_config() -> Dict[str, Any]:
    _ensure()
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_config(cfg: Dict[str, Any]):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

def list_connectors() -> Dict[str, Any]:
    return load_config()

def update_connector(name: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    cfg = load_config()
    if name not in cfg:
        raise ValueError(f"connector '{name}' not found")
    cfg[name].update(patch)
    save_config(cfg)
    return cfg[name]

def _iter_local_docs(path: str) -> List[Document]:
    if not path or not os.path.exists(path):
        return []

    docs: List[Document] = []

    # (pattern, loader_cls, loader_kwargs)
    patterns = [
        ("**/*.md",   TextLoader, {"encoding": "utf-8", "autodetect_encoding": True}),
        ("**/*.txt",  TextLoader, {"encoding": "utf-8", "autodetect_encoding": True}),
        ("**/*.pdf",  PyPDFLoader, {}),
        ("**/*.csv",  CSVLoader, {}),
        # habilite os dois abaixo se instalar as dependências
        ("**/*.docx", Docx2txtLoader, {}),
        ("**/*.xlsx", UnstructuredExcelLoader, {"mode": "elements"}),  # requer 'unstructured'
    ]

    for pattern, loader_cls, loader_kwargs in patterns:
        try:
            loader = DirectoryLoader(
                path,
                glob=pattern,
                loader_cls=loader_cls,
                loader_kwargs=loader_kwargs,     # <-- aqui entram 'encoding'/'autodetect'
                show_progress=True,
                use_multithreading=True
            )
            docs.extend(loader.load())
        except Exception as e:
            # Se preferir, logue o erro:
            # print(f"[LOCAL] Falha ao carregar {pattern}: {e}")
            pass

    # --- Normalização de metadados ---
    for d in docs:
        src = d.metadata.get("source") or d.metadata.get("file_path") or "local"
        d.metadata["source"] = str(src).replace("\\", "/")
        d.metadata.setdefault("connector", "local")
        if "page" not in d.metadata and "page_number" in d.metadata:
            d.metadata["page"] = d.metadata["page_number"]

    return docs

def _iter_url_docs(urls: List[str]) -> List[Document]:
    urls = [u for u in (urls or []) if isinstance(u, str) and u.strip()]
    if not urls:
        return []
    loader = WebBaseLoader(urls)
    docs = loader.load()
    for d in docs:
        d.metadata.setdefault("connector", "urls")
    return docs

# Placeholders (implementar quando houver credenciais)
def _iter_notion_docs(_: Dict[str, Any]) -> List[Document]:
    # TODO: usar Notion API -> converter para markdown / texto
    return []

def _iter_gdrive_docs(_: Dict[str, Any]) -> List[Document]:
    # TODO: usar Drive API (service account) -> baixar arquivos
    return []

def _iter_m365_docs(_: Dict[str, Any]) -> List[Document]:
    # TODO: usar Microsoft Graph (SharePoint/OneDrive)
    return []

def collect_documents() -> List[Document]:
    cfg = load_config()
    out: List[Document] = []
    if cfg.get("local", {}).get("enabled"):
        out.extend(_iter_local_docs(cfg["local"].get("path", "app/data/docs")))
    if cfg.get("urls", {}).get("enabled"):
        out.extend(_iter_url_docs(cfg["urls"].get("list", [])))
    if cfg.get("notion", {}).get("enabled"):
        out.extend(_iter_notion_docs(cfg["notion"]))
    if cfg.get("gdrive", {}).get("enabled"):
        out.extend(_iter_gdrive_docs(cfg["gdrive"]))
    if cfg.get("m365", {}).get("enabled"):
        out.extend(_iter_m365_docs(cfg["m365"]))
    return out
