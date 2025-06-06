"""
1. UPLOAD\n
   Cliente → "UPLOAD\n" | 8 bytes (uint64 tamanho) | bytes do PDF.
   → Servidor gera UUID, salva em pdf_storage/<uuid>.pdf e devolve "<uuid>\n".

2. DOWNLOAD <uuid>\n
   Cliente → "DOWNLOAD <uuid>\n".
   → Servidor responde:
        • "FOUND\n" + 8 bytes tamanho + bytes                       (arquivo existe)
        • "NOTFOUND\n"                                             (não encontrado)

3. MERGE\n
   Cliente → "MERGE\n" | 8 bytes A | PDF A | 8 bytes B | PDF B.
   → Servidor concatena páginas (A, depois B), salva, devolve UUID.

4. EXTRACT <start>-<end>\n
   Cliente → "EXTRACT 1-5\n" | 8 bytes | PDF.
   → Se o PDF possuir páginas ≥ end, extrai intervalo [start,end],
     salva e devolve UUID; caso contrário, responde "PAGEERR\n".
"""

from __future__ import annotations

import io
import re
import socket
import struct
import threading
import uuid
from pathlib import Path
from typing import Tuple

try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError as exc:
    raise SystemExit("PyPDF2 não instalado. Execute: pip install PyPDF2") from exc

HOST = "0.0.0.0"
PORT = 9000
STORAGE_DIR = Path("pdf_storage")
BUFFER_SIZE = 1 << 20  # 1 MiB

STORAGE_DIR.mkdir(exist_ok=True)

# ---------------- utils ----------------

def _read_line(conn: socket.socket) -> str:
    buf = bytearray()
    while not buf.endswith(b"\n"):
        chunk = conn.recv(1)
        if not chunk:
            break
        buf.extend(chunk)
    return buf.decode().strip()

def _recv_exact(conn: socket.socket, size: int) -> bytes:
    buf = bytearray()
    while len(buf) < size:
        chunk = conn.recv(min(BUFFER_SIZE, size - len(buf)))
        if not chunk:
            raise ValueError("Conexão encerrada prematuramente")
        buf.extend(chunk)
    return bytes(buf)

def _save_pdf(data: bytes) -> str:
    file_uuid = str(uuid.uuid4())
    (STORAGE_DIR / f"{file_uuid}.pdf").write_bytes(data)
    return file_uuid

# ---------------- operações de PDF ----------------

def _merge_pdfs(data_a: bytes, data_b: bytes) -> bytes:
    reader_a, reader_b = PdfReader(io.BytesIO(data_a)), PdfReader(io.BytesIO(data_b))
    writer = PdfWriter()
    for p in reader_a.pages:
        writer.add_page(p)
    for p in reader_b.pages:
        writer.add_page(p)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

def _extract_range(data: bytes, start: int, end: int) -> bytes:
    reader = PdfReader(io.BytesIO(data))
    if len(reader.pages) < end:
        raise ValueError("NOT_ENOUGH_PAGES")
    writer = PdfWriter()
    for idx in range(start - 1, end):  # 0‑based
        writer.add_page(reader.pages[idx])
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

# ---------------- handler ----------------

def handle_client(conn: socket.socket, addr: Tuple[str, int]):
    try:
        cmd_line = _read_line(conn)
        if not cmd_line:
            return

        # ---- UPLOAD ----
        if cmd_line == "UPLOAD":
            size = struct.unpack("!Q", _recv_exact(conn, 8))[0]
            data = _recv_exact(conn, size)
            uuid_str = _save_pdf(data)
            conn.sendall(f"{uuid_str}\n".encode())
            print(f"[UPLOAD] {addr} -> {uuid_str} ({size} bytes)")
            return

        # ---- DOWNLOAD ----
        if cmd_line.startswith("DOWNLOAD"):
            parts = cmd_line.split()
            if len(parts) != 2:
                conn.sendall(b"BADREQUEST\n"); return
            uuid_str = parts[1]
            path = STORAGE_DIR / f"{uuid_str}.pdf"
            if not path.exists():
                conn.sendall(b"NOTFOUND\n"); return
            size = path.stat().st_size
            conn.sendall(b"FOUND\n" + struct.pack("!Q", size))
            with path.open("rb") as fp:
                while chunk := fp.read(BUFFER_SIZE):
                    conn.sendall(chunk)
            print(f"[DOWNLOAD] {addr} <- {uuid_str} ({size} bytes)")
            return

        # ---- MERGE ----
        if cmd_line == "MERGE":
            size_a = struct.unpack("!Q", _recv_exact(conn, 8))[0]
            data_a = _recv_exact(conn, size_a)
            size_b = struct.unpack("!Q", _recv_exact(conn, 8))[0]
            data_b = _recv_exact(conn, size_b)
            merged = _merge_pdfs(data_a, data_b)
            uuid_str = _save_pdf(merged)
            conn.sendall(f"{uuid_str}\n".encode())
            print(f"[MERGE] {addr} -> {uuid_str}")
            return

        # ---- EXTRACT ----
        if cmd_line.startswith("EXTRACT"):
            m = re.match(r"EXTRACT\s+(\d+)-(\d+)$", cmd_line)
            if not m:
                conn.sendall(b"BADREQUEST\n"); return
            start, end = map(int, m.groups())
            if start < 1 or end < start:
                conn.sendall(b"BADREQUEST\n"); return
            size = struct.unpack("!Q", _recv_exact(conn, 8))[0]
            data = _recv_exact(conn, size)
            try:
                extracted = _extract_range(data, start, end)
            except ValueError:
                conn.sendall(b"PAGEERR\n"); return
            uuid_str = _save_pdf(extracted)
            conn.sendall(f"{uuid_str}\n".encode())
            print(f"[EXTRACT] {addr} -> {uuid_str} ({start}-{end})")
            return

        # ---- desconhecido ----
        conn.sendall(b"UNKNOWN\n")
    except Exception as e:
        print(f"[ERROR] {addr}: {e}")
    finally:
        conn.close()

# ---------------- main ----------------

def start_server(host: str = HOST, port: int = PORT):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as srv:
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((host, port))
        srv.listen()
        print(f"Servidor escutando em {host}:{port}")
        while True:
            conn, addr = srv.accept()
            threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()

if __name__ == "__main__":
    start_server()
