@echo off

SET PATH=bin;%PATH%

REM https://www.microsoft.com/resources/documentation/windows/xp/all/proddocs/en-us/redirection.mspx?mfr=true

REM So in a batch file, there is no way to do the equivalent of the bash
REM set -e (exit immediately on error). Only thing you can do is put
REM     || goto :error
REM at the end of each line.

sfexport "select Id from Account" > foo.csv || goto :error

goto :EOF

:error
echo ERROR %errorlevel%
exit /b %errorlevel%

:EOF