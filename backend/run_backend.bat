@echo off
set "PATH=%~dp0.venv\Scripts;C:\Program Files\Tesseract-OCR;C:\Users\shrey\.tools\tesseract;%PATH%"
cd /d "%~dp0"
call .venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
