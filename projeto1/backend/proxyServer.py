"""
Servidor HTTP intermediário (FastAPI) que se comunica via socket com
o servidor.

Dependências:
  pip install fastapi uvicorn python-multipart PyPDF2

Endpoints:
  POST /upload      – envia um PDF e devolve uuid
  POST /merge       – envia dois PDFs (file1, file2) e devolve uuid
  POST /extract     – form-data: file (PDF) + range="1-5"  ⇒ devolve uuid
  GET  /download/{uuid} – retorna o PDF salvo
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import socket
import struct
import re
from typing import Generator

SOCKET_HOST = "0.0.0.0"
SOCKET_PORT = 9000
BUFFER_SIZE = 1 << 20

app = FastAPI(title="PDF Intermediary Server")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.15.96:5173",   # IP do seu PC na LAN
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- helpers de socket ----------

def _send(sock: socket.socket, data: bytes):
    sock.sendall(data)

def _recv_exact(sock: socket.socket, size: int) -> bytes:
    buf = bytearray()
    while len(buf) < size:
        chunk = sock.recv(min(BUFFER_SIZE, size - len(buf)))
        if not chunk:
            raise RuntimeError("Conexão encerrada")
        buf.extend(chunk)
    return bytes(buf)

def _recv_line(sock: socket.socket) -> str:
    buf = bytearray()
    while not buf.endswith(b"\n"):
        chunk = sock.recv(1)
        if not chunk:
            break
        buf.extend(chunk)
    return buf.decode().strip()

# ---------- validações ----------

def _validate_pdf(up: UploadFile, field: str):
    if up.content_type != "application/pdf" or not up.filename.lower().endswith(".pdf"):
        raise HTTPException(415, f"{field}: apenas .pdf válido")

_range_re = re.compile(r"^(\d+)-(\d+)$")

def _parse_range(rng: str):
    m = _range_re.match(rng)
    if not m:
        raise HTTPException(400, "Formato de range deve ser 'start-end'")
    start, end = map(int, m.groups())
    if start < 1 or end < start:
        raise HTTPException(400, "Range inválido")
    return start, end

# ---------- operações socket ----------

def _upload_socket(pdf: bytes) -> str:
    with socket.socket() as s:
        s.connect((SOCKET_HOST, SOCKET_PORT))
        _send(s, b"UPLOAD\n" + struct.pack("!Q", len(pdf)) + pdf)
        return _recv_line(s)

def _merge_socket(a: bytes, b: bytes) -> str:
    with socket.socket() as s:
        s.connect((SOCKET_HOST, SOCKET_PORT))
        _send(s, b"MERGE\n")
        _send(s, struct.pack("!Q", len(a)) + a)
        _send(s, struct.pack("!Q", len(b)) + b)
        return _recv_line(s)

def _extract_socket(pdf: bytes, start: int, end: int) -> str:
    with socket.socket() as s:
        s.connect((SOCKET_HOST, SOCKET_PORT))
        _send(s, f"EXTRACT {start}-{end}\n".encode())
        _send(s, struct.pack("!Q", len(pdf)) + pdf)
        resp = _recv_line(s)
        if resp == "PAGEERR":
            raise HTTPException(400, "PDF possui menos páginas que o range solicitado")
        return resp

def _download_socket(uuid_str: str) -> bytes:
    with socket.socket() as s:
        s.connect((SOCKET_HOST, SOCKET_PORT))
        _send(s, f"DOWNLOAD {uuid_str}\n".encode())
        status = _recv_line(s)
        if status == "NOTFOUND":
            raise FileNotFoundError()
        if status != "FOUND":
            raise RuntimeError(status)
        size = struct.unpack("!Q", _recv_exact(s, 8))[0]
        return _recv_exact(s, size)

# ---------- endpoints ----------

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    _validate_pdf(file, "file")
    data = await file.read()
    return {"uuid": _upload_socket(data)}

@app.post("/merge")
async def merge(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    for f, n in ((file1, "file1"), (file2, "file2")):
        _validate_pdf(f, n)
    data1, data2 = await file1.read(), await file2.read()
    return {"uuid": _merge_socket(data1, data2)}

@app.post("/extract")
async def extract(range: str = Form(...), file: UploadFile = File(...)):
    _validate_pdf(file, "file")
    start, end = _parse_range(range)
    data = await file.read()
    return {"uuid": _extract_socket(data, start, end)}

@app.get("/download/{uuid_str}")
async def download(uuid_str: str):
    try:
        pdf = _download_socket(uuid_str)
    except FileNotFoundError:
        raise HTTPException(404, "Arquivo não encontrado")
    headers = {"Content-Disposition": f"attachment; filename={uuid_str}.pdf"}
    return StreamingResponse(iter([pdf]), media_type="application/pdf", headers=headers)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fastapi_intermediary:app", host="0.0.0.0", port=8080, reload=True)
