@echo off
set "PATH=C:\Users\shrey\.tools\nodejs;%PATH%"
cd /d "%~dp0"
call npm.cmd %*
