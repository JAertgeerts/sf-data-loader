#!/usr/bin/env node

'use strict';

const multipipe = require('multipipe');
const csvParse = require('csv-parse');
const path = require('path');
const AddBatchTransform = require('../lib/add-batch-transform');
const fs = require('fs');
let bulkOptions = null;
let batchOptions = {};
let input = process.stdin;

exports = module.exports = (operation, cmd) => {
  if (cmd.inputFile) {
    input = fs.createReadStream(cmd.inputFile);
  }
  if (cmd.config) {
    if (path.isAbsolute(cmd.config)) {
      bulkOptions = require(cmd.config).bulkApi;
    } else {
      bulkOptions = require(path.join(process.cwd(), cmd.config)).bulkApi;
    }
  } else {
    bulkOptions = require(path.join(process.cwd(), 'config')).bulkApi;
  }
  if (cmd.concurrencyMode) {
    bulkOptions.concurrencyMode = cmd.concurrencyMode;
  }
  if (cmd.batchSize) {
    batchOptions.batchSize = cmd.batchSize;
  }
  bulkOptions.object = cmd.object;
  bulkOptions.operation = operation;
  if (operation === 'upsert') {
    bulkOptions.externalIdFieldName = cmd.externalId;
  }
  const transform = new AddBatchTransform(bulkOptions, batchOptions);

  const handleError = (err) => {
    if (err) {
      console.error('ERROR', err);
      transform.bulk.abortJob(() => {
        process.exit(9);
      });
    }
  };

  const showProgress = (state) => {
    if (!state.jobInfo) {
      console.log('No progress', state);
      return;
    }
    let queued = 0;
    let progress = 0;
    let completed = 0;
    let failed = 0;
    let notProcessed = 0;
    let numberRecordsFailed = 0;
    let numberRecordsProcessed = 0;
    state.batchInfos.forEach((bi) => {
      numberRecordsFailed = bi.numberRecordsFailed;
      numberRecordsProcessed = bi.numberRecordsProcessed;
      if (bi.state === 'Queued') {
        queued++;
      }
      if (bi.state === 'InProgress') {
        progress++;
      }
      if (bi.state === 'Completed') {
        completed++;
      }
      if (bi.state === 'Failed') {
        failed++;
      }
      if (bi.state === 'Not Processed') {
        notProcessed++;
      }
    });
    let info = {
      job: {
        state: state.jobInfo.state,
        id: state.jobInfo.id
      },
      batches: {
        queued,
        progress,
        completed,
        failed,
        notProcessed,
      },
      records: {
        numberRecordsFailed,
        numberRecordsProcessed
      }
    };
    console.log(JSON.stringify(info));
  };

  multipipe(
    input,
    csvParse({
      columns: true
    }),
    transform,
    (err) => {
      handleError(err);
      if (cmd.showProgress) {
        transform.bulk.on('currentState', (state) => {
          showProgress(state);
        });
        transform.bulk.on('finalState', (state) => {
          showProgress(state);
        });
      }
      if (cmd.failOnError) {
        transform.bulk.on('currentState', (state) => {
          if (state.isError()) {
            handleError(new Error(JSON.stringify(state)));
          }
        });
        transform.bulk.once('finalState', (state) => {
          if (state.isError()) {
            handleError(new Error(JSON.stringify(state)));
          }
        });
      }
    });
  process.on('SIGINT', function() {
    transform.bulk.abortJob();
    console.log("Aborting SF Job.");
  });
};

// { loginResults:
//    { metadataServerUrl: [ 'https://wycliffe--jdsDev2.cs52.my.salesforce.com/services/Soap/m/37.0/00D5B000000DA7Z' ],
//      passwordExpired: [ 'false' ],
//      sandbox: [ 'true' ],
//      serverUrl: [ 'https://wycliffe--jdsDev2.cs52.my.salesforce.com/services/Soap/u/37.0/00D5B000000DA7Z' ],
//      sessionId: [ '00D5B000000DA7Z!AQ8AQFlN.eUF7R7Xyf8VAqevgf4u93d8gCuGwd0.9Qc.7yIv4yH6wT8FQB1uIhgpf_Sw1ojhQxksTtA4TW4hbr.FjMhBqe5F' ],
//      userId: [ '00536000002wXn4AAE' ],
//      userInfo: [ [Object] ] },
//   jobInfo:
//    { apexProcessingTime: 23,
//      apiActiveProcessingTime: 83,
//      apiVersion: 37,
//      assignmentRuleId: null,
//      concurrencyMode: 'Parallel',
//      contentType: 'JSON',
//      createdById: '00536000002wXn4AAE',
//      createdDate: '2016-11-02T08:39:30.000+0000',
//      externalIdFieldName: null,
//      fastPathEnabled: false,
//      id: '7505B000000QHkXQAW',
//      numberBatchesCompleted: 1,
//      numberBatchesFailed: 0,
//      numberBatchesInProgress: 0,
//      numberBatchesQueued: 0,
//      numberBatchesTotal: 1,
//      numberRecordsFailed: 0,
//      numberRecordsProcessed: 4,
//      numberRetries: 0,
//      object: 'Account',
//      operation: 'insert',
//      state: 'Closed',
//      systemModstamp: '2016-11-02T08:39:30.000+0000',
//      totalProcessingTime: 136 },
//   batchInfos:
//    [ { apexProcessingTime: 23,
//        apiActiveProcessingTime: 83,
//        createdDate: '2016-11-02T08:39:30.000+0000',
//        id: '7515B000000LjdyQAC',
//        jobId: '7505B000000QHkXQAW',
//        numberRecordsFailed: 0,
//        numberRecordsProcessed: 4,
//        state: 'Completed',
//        stateMessage: null,
//        systemModstamp: '2016-11-02T08:39:30.000+0000',
//        totalProcessingTime: 136 } ],
//   queryBatchResults: [],
//   isError: [Function] }