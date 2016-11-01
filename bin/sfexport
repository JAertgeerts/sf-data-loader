#!/usr/bin/env node

'use strict';

const multipipe = require('multipipe');
const path = require('path');
const sqlparser = require('sql-parser');
const csvStringify = require('csv-stringify');
const BulkQueryReadable = require('../lib/bulk-query-readable');
const bulkOptions = require(path.join(process.cwd(), 'config')).bulkApi;

if (!process.argv[2]) {
  console.log('');
  console.log('Exports SOQL in CSV format to STDOUT');
  console.log('');
  console.log('    Usage: export.js SOQL');
  console.log('');
  process.exit(6);
}

const soql = process.argv[2];

bulkOptions.object = getObjectFromSoql(soql);
bulkOptions.operation = 'query';

multipipe(
  new BulkQueryReadable(soql, bulkOptions).init(),
  csvStringify({
    header: true
  }),
  process.stdout,
  (err) => {
    if (err) {
      console.error('ERROR', err);
      process.exit(9);
    }
  });

function getObjectFromSoql(soql) {
  const tokens = sqlparser.lexer.tokenize(soql);
  let accountIsNext = false;
  let object = null;
  tokens.forEach((token) => {
    if (accountIsNext) {
      object = token[1];
      accountIsNext = false;
    }
    if (token[0] === 'FROM') {
      accountIsNext = true;
    }
  });
  return object;
}