#!/usr/bin/env node

'use strict';

const stream = require('stream');
const BulkApi = require('./bulk-api');
const JSONStream = require('JSONStream');

// "Readable" stream which of course is actually a Transform stream.
// Allows you to easily query Salesforce and get the results as a stream
// of JSON objects.

// WARNING!!! WARNING!!! WARNING!!! WARNING!!! WARNING!!! WARNING!!! WARNING!!!

// This works when all goes well, but I have not yet figured out how to get the
// stream errors to propagate properly. Very well may have to change the
// implementation, but should be able to keep the same interface.

class BulkQueryReadable extends stream.Transform {
  constructor(soql, bulkOptions, streamOptions) {
    streamOptions = streamOptions || {};
    streamOptions.objectMode = true;
    super(streamOptions);
    this.soql = soql;
    this.bulkOptions = bulkOptions;
  }
  init() {
    if (!this.bulk) {
      this.bulk = new BulkApi(this.bulkOptions);
      this.bulk.query(this.soql, (err) => {
        if (err) this.emit('error', err);
        this.bulk.once('finalState', () => {
          this.bulk.getQueryResult().pipe(JSONStream.parse('*')).pipe(this);
        });
      });
    }
    return this;
  }
  _transform(data, encoding, callback) {
    delete data.attributes;
    this.push(data);
    callback();
  }
}

exports = module.exports = BulkQueryReadable;