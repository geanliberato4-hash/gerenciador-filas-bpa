@echo off
REM ==========================================================
REM  TELA DE CHAMADA - BPA
REM  Abre a tela da TV em tela cheia, com o SOM SEMPRE LIBERADO.
REM  Coloque um atalho deste arquivo na area de trabalho do
REM  computador da TV (e, se quiser, na pasta Inicializar do Windows
REM  para abrir sozinho ao ligar o computador).
REM  Para sair da tela cheia: Alt + F4
REM ==========================================================

set URL=https://geanliberato4-hash.github.io/gerenciador-filas-bpa/chamada.html
set OPCOES=--autoplay-policy=no-user-gesture-required --kiosk --user-data-dir="%LOCALAPPDATA%\TelaChamadaBPA" --no-first-run --disable-session-crashed-bubble

set NAV=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set NAV="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set NAV="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set NAV="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set NAV="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set NAV="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if not defined NAV (
  echo Nao encontrei o Google Chrome nem o Microsoft Edge neste computador.
  pause
  exit /b 1
)

start "" %NAV% %OPCOES% "%URL%"
