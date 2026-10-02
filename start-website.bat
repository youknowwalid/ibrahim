@echo off
cd /d "%~dp0"
echo Starting the website... keep this window open. Visit http://localhost:3000
start "" http://localhost:3000/admin
node server\index.js
pause
