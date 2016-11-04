# Microsoft SQL Server

https://github.com/patriksimek/node-mssql

You will need to `nmp install mssql` to connect use the `export.js` and
`import.js` modules.

You may also need to install a driver if the default driver doesn't meet your
needs: https://github.com/patriksimek/node-mssql#drivers-1

`export.js` turns any SQL query into a stream of CSV.

`insert.js` takes a stream of CSV and inserts it into a table in SQL server.
You can optionally drop/create the table before insert.