@echo off
title Weekly Countdown Server
echo Starting Weekly Countdown on http://localhost:8080 ...
echo Press Ctrl+C to stop.
echo.
start "" "http://localhost:8080"
cd /d "%~dp0"
python -m http.server 8080 --bind 127.0.0.1
