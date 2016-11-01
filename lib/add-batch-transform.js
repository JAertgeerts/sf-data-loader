#!/usr/bin/env node

'use strict';

const stream = require('stream');
const BulkApi = require('./bulk-api');

// Transform stream for adding batches of JSON objects to bulk api job.

// Could have used a writable stream but transform streams are more  flexible.
// For one thing, they come with a _flush() method. Also it allows us to keep
// piping the results on down a the lane if we want to.

class AddBatchTransform extends stream.Transform {

  constructor(bulkOptions, options, streamOptions) {
    streamOptions = streamOptions || {};
    streamOptions.objectMode = true;
    super(streamOptions);
    this.bulk = new BulkApi(bulkOptions);
    this.options = options || {};
    this.options.batchSize = this.options.batchSize || 1000;
    this.state = {};
    this.state.rows = [];
    this.state.flushing = false;
  }

  _sendBatch(cb) {
    this.bulk.addBatch(this.state.rows, (err) => {
      if (this.state.flushing) {
        this.bulk.closeJob();
      }
      this.state.rows = [];
      cb(err);
    });
  }

  _fixStuff(data) {
    // empty string to null
    Object.keys(data).forEach((k) => {
      if (data[k].trim() === '') {
        data[k] = null;
      }
    });
    Object.keys(data).forEach((k) => {
      if (data[k] === 'true' || data[k] === 'false') {
        data[k] = data[k] === 'true';
      }
    });
    return data;
  }

  _transform(data, encoding, cb) {
    this.state.rows.push(this._fixStuff(data));
    if (this.state.rows.length === this.options.batchSize) {
      this._sendBatch(cb);
    } else {
      cb();
    }
  }

  _flush(cb) {
    this.state.flushing = true;
    this._sendBatch(cb);
  }
}

exports = module.exports = AddBatchTransform;