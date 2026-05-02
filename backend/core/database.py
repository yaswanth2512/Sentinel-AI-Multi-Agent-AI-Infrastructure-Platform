import sqlite3
import duckdb
import chromadb
import os

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DB_DIR, exist_ok=True)

# SQLite for agent state
SQLITE_DB = os.path.join(DB_DIR, "state.db")

# DuckDB for evaluation analytics
DUCKDB_FILE = os.path.join(DB_DIR, "analytics.duckdb")

def init_db():
    # Init SQLite
    conn = sqlite3.connect(SQLITE_DB)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS runs
                 (run_id TEXT PRIMARY KEY, status TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

    # Init DuckDB
    con = duckdb.connect(DUCKDB_FILE)
    con.execute('''CREATE TABLE IF NOT EXISTS metrics
                   (run_id VARCHAR, agent VARCHAR, latency DOUBLE, success BOOLEAN)''')
    con.close()

def get_chroma_client():
    return chromadb.PersistentClient(path=os.path.join(DB_DIR, "chroma"))

def get_duckdb_conn():
    return duckdb.connect(DUCKDB_FILE)

def get_sqlite_conn():
    return sqlite3.connect(SQLITE_DB)
