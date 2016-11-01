#!/usr/bin/env node

'use strict';

const stream = require('stream');
const BulkQueryReadable = require('../lib/bulk-query-readable');
const bulkOptions = require('./config').bulkApi;

bulkOptions.object = 'Account';
bulkOptions.operation = 'query';

const readable = new BulkQueryReadable('select Id, Name from Account', bulkOptions);

const transform = new stream.Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    console.log('transform', JSON.stringify(chunk));
    callback();
  },
  flush(callback) {
    console.log('flush');
    callback();
  }
});

readable.pipe(transform)
  .on('finish', () => {
    console.log('finish');
  })
  .on('error', (err) => {
    console.log('error', err);
  });