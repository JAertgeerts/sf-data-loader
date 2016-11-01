#!/usr/bin/env node

'use strict';

const multipipe = require('multipipe');
const csvParse = require('csv-parse');
const path = require('path');
const AddBatchTransform = require('../lib/add-batch-transform');

let bulkOptions = require(path.join(process.cwd(), 'config')).bulkApi;
let batchOptions = {};

if (!process.argv[2]) {
  console.log('');
  console.log('Inserts rows into the SF OBJECT from STDIN in CSV format.');
  console.log('');
  console.log('    Usage: insert.js OBJECT [ BULK_OPTIONS ] [ BATCH_OPTIONS ]');
  console.log('');
  process.exit(6);
}

if (process.argv[3]) {
  bulkOptions = Object.assign(bulkOptions, JSON.parse(process.argv[3]));
}

if (process.argv[4]) {
  batchOptions = JSON.parse(process.argv[4]);
}

bulkOptions.object = process.argv[2];
bulkOptions.operation = 'insert';
const transform = new AddBatchTransform(bulkOptions, batchOptions);

multipipe(
  process.stdin,
  csvParse({
    columns: true
  }),
  transform,
  (err) => {
    if (err) {
      console.error('ERROR', err);
      process.exit(9);
    }
  });

process.on('SIGINT', function() {
  transform.bulk.abortJob();
  console.log("Aborting SF Job.");
});