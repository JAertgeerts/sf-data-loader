#!/usr/bin/env node

'use strict';

const MsSqlExport = require('../lib/mssql/export');
const options = require('../config');
const multipipe = require('multipipe');
const csvStringify = require('csv-stringify');
const JSONStream = require('JSONStream');

let transform = JSONStream.stringify('', '\n', '\n');
transform = csvStringify({
  header: true
});

options.sql = 'select * from sf_contact';

const readable = new MsSqlExport(options);

multipipe(readable, transform, process.stdout, (err) => {
  if (err) {
    return console.error('ERROR', err);
  }
});