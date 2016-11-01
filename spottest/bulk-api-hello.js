#!/usr/bin/env node

'use strict';

const BulkApi = require('../lib/bulk-api');
const options = require('./config').bulkApi;
options.object = 'Account';
options.operation = 'insert';

// const bulk = new BulkApi(options);
// bulk.addBatch([{
//   Name: 'ASDFKASFKDS wella account'
// }, {
//   Name: '@#$%@#$% nutha act'
// }], (err, results) => {
//   console.log(err, results);
//   bulk.closeJob((err, results) => {
//     console.log(err, results);
//     bulk.closeJob((err, results) => {
//       console.log(err, results);
//       let batchId = bulk.state.batchInfos[0].id;
//       console.log('batchId !!!!!!!!', batchId);
//       bulk.getBatchRequest(batchId, (err, batchRequest) => {
//         console.log('getBatchRequest', err, batchRequest);
//       });
//       setTimeout(() => {
//         bulk.getBatchResult(batchId)
//           .on('data', (chunk) => {
//             console.error('getBatchResult data', chunk.toString());
//           })
//           .on('error', (err) => {
//             console.error('getBatchResult Error', err);
//           });
//       }, 1000);
//     });
//   });
// });

// options.operation = 'query';
// const bulk = new BulkApi(options);
// bulk.query(
//   'select Id, Name from Account',
//   (err, batchInfo) => {
//     console.log('bulk.query', err, batchInfo);
//     bulk.closeJob();
//     setTimeout(() => {
//       bulk.getBatchInfos((err, batchInfos) => {
//         let batchId = bulk.state.batchInfos[0].id;
//         console.log('bulk.state.batchInfos', bulk.state.batchInfos);
//         bulk.getBatchResult(batchId, (err, batchResult) => {
//           console.log('bulk.getBatchResult', err, batchResult);
//           bulk.getQueryResult(batchId, batchResult[0], (err, results) => {
//             console.log('getQueryResult', err, results);
//             console.log('bulk: ' + JSON.stringify(bulk, null, 3));
//           });
//         });
//       });
//     }, 1000);
//   }
// );

options.operation = 'query';

const bulk = new BulkApi(options)
  .query('select Id, Name from Account')
  // .on('currentState', (state) => {
  // console.log('currentState', JSON.stringify(state, null, 3));
  // })
  .on('finalState', (state) => {
    console.log('finalState', JSON.stringify(state, null, 3));
    // let batchId = bulk.state.batchInfos[0].id;
    // bulk.getBatchResult(batchId, (err, batchResults) => {
    //   console.log('bulk.getBatchResult', err, batchResults);
    // bulk.getQueryResult(batchId, batchResults[0])
    bulk.getQueryResult()
      .on('data', (data) => {
        console.log('getQueryResult', data.toString());
      })
      .on('error', (err) => {
        console.log('getQueryResult ERR', err);
      });
    // });
  });