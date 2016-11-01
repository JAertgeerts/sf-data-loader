#!/usr/bin/env node

'use strict';

const stream = require('stream');
const AddBatchTransform = require('../lib/add-batch-transform');
const bulkOptions = require('./config').bulkApi;

const readable = new stream.Readable({
  objectMode: true,
  read() {
    let i = 0;
    do {
      this.push({
        Name: `Frank ${i}`
      });
    } while (i++ < 5);
    this.push(null);
  }
});

bulkOptions.object = 'Account';
bulkOptions.operation = 'insert';

const transform = new AddBatchTransform(bulkOptions);

readable
  .pipe(transform)
  .on('finish', () => {
    console.log('finish');
  })
  .on('error', (err) => {
    console.log('error', err);
  });