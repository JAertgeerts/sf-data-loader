# sf-data-loader

Salesforce Data Loader for Node.js

WARNING ALPHA SOFTWARE !!! DO NOT COUNT ON http://semver.org/ till we are on
first base.

Rome wasn't built in a day.

## TODO

* npm package bin for both *nix and Windoze.
    http://stackoverflow.com/questions/10396305/npm-package-bin-script-for-windows
* figure out Windoze command line piping.

## Features

* Bulk query readable stream
* PK chunking query readable stream
* Insert, update, upsert, delete, hard delete as writable stream (with
    request file cached locally)
* CSV success and error file writable stream
* Foo