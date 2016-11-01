REM %~dp0 is the drive and path of this file. So essentially we are saying
REM if node.exe is in this dir, then execute it on the sfinsert file and
REM pass any other params along.
REM if node.exe is not in this folder, just run whatever node is on the path.
@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\sfinsert" %*
) ELSE (
  @SETLOCAL
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\sfinsert" %*
)