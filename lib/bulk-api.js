#!/usr/bin/env node

'use strict';

const EventEmitter = require('events').EventEmitter;
const request = require('request');
const parseString = require('xml2js').parseString;

// Implements the SF Bulk API.
// http://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_batches_intro.htm

// TODO !!! query with PK chunking (for over 5 million rows) WARNING WHEN PK
// chunking is enabled, the original batch is given a state of Not Processed.
// The query is processed in the remaining batches. ALSO PK chunking is set
// when you create the JOB, not the batch. The rest pretty much works the same
// but you just need to get the query result multiple times from multiple
// batches.

class BulkApi extends EventEmitter {

  constructor(options) {
    super(); // must call super() if we extend EventEmitter.
    if (!options) throw new Error('options required');
    // loginUrl: something like https://cs60.salesforce.com. Make sure to use
    // your actual instance domain name and not just 'test.salesforce.com' or
    // 'login.salesforce.com'
    if (!options.loginUrl) throw new Error('options.loginUrl required');
    // apiVersion: The version of the SF api we are targeting. Example: 37.0
    if (!options.apiVersion) throw new Error('options.apiVersion required');
    // username / password / token: You know what these are.
    if (!options.username) throw new Error('options.username required');
    if (!options.password) throw new Error('options.password required');
    if (!options.token) throw new Error('options.token required');
    // object: The SF object API name, 'Account', 'My_Custom_Object__c', etc.
    if (!options.object) throw new Error('options.object required');
    // operation: 'delete' | 'insert' | 'query' | 'upsert' | 'update' | 'hardDelete'
    if (!options.operation) throw new Error('options.operation required');
    if (options.operation === 'upsert') {
      if (!options.externalIdFieldName) throw new Error('options.externalIdFieldName required for upsert');
    }
    this.options = options;
    // concurrencyMode:  Parallel | Serial
    this.options.concurrencyMode = this.options.concurrencyMode || 'Parallel';
    // For now we only do content type of JSON because we don't want to have to
    // handle both XML and JSON HTTP responses. For any content types other than
    // JSON SF does all HTTP responses in XML :(
    this.options.contentType = 'JSON';
    this.state = {};
    this.state.loginResults = null;
    this.state.jobInfo = null;
    this.state.batchInfos = [];
    // Batch results when you are pushing data into SF can be huge, so we
    // don't want to save those in state. But batch results for queries are
    // just an array of IDs you need to get the actual query results.
    // so queryBatchResults are just normal batch results but only for
    // queries, not for inserts, updates, etc.
    this.state.queryBatchResults = [];
    // WARNING!!! Do not start polling for results until you are done
    // adding batches. In the case where all the batches you added were
    // zero length, we won't login, no job or batches will be created.
    // we will have done nothing. we assume final state of success in
    // this case.
    this.on('newListener', (eventName) => {
      if (eventName === 'currentState' || eventName === 'finalState') {
        this.startPolling();
      }
    });
    this.intervalId = null;
    // This is only valid on currentState or finalState.
    // We just check for any errors and return true if we find any.
    this.state.isError = () => {
      if (!this.state.jobInfo) {
        return;
      }
      let rv = false;
      if (this.state.jobInfo.state === 'Aborted' ||
        this.state.jobInfo.state === 'Failed') {
        rv = true;
      } else {
        this.state.batchInfos.forEach((bi) => {
          if (bi.state === 'Failed' || bi.state === 'Not Processed' || bi.numberRecordsFailed > 0) {
            rv = true;
          }
        });
      }
      return rv;
    };
  }

  // So keep polling super simple. If someone adds a listener for 'finalState'
  // or 'currentState' we will poll and emit 'currentState' every five seconds
  // and 'finalState' once when job is in final state and all batches are in
  // final state. Both events will simply pass this.state. It will then be up to
  // the client to decide what it wants to do based on the info.

  // Maybe we need to make this a bit more smart. So when it's a query or
  // bulk query we also get all the batch results. So on final state we can
  // just directly ask for the query result. And for

  // WARNING WHEN PK chunking is enabled, the original batch is given a state of
  // Not Processed. The query is processed in the remaining batches. So we will
  // have to change our logic to account for that.
  startPolling() {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        if (!this.state.jobInfo) {
          clearInterval(this.intervalId);
          return this.emit('finalState', this.state);
        }
        this.getJobInfo((err) => {
          if (err) return this.emit('pollingError', err);
          this.getBatchInfos((err) => {
            if (err) return this.emit('pollingError', err);
            if (this.isJobFinalState() && this.isBatchFinalState()) {
              // TODO logic will need to change when we implement bulk
              // query PK chunking.
              if (this.state.jobInfo.operation === 'query') {
                this.getBatchResult(
                  this.state.batchInfos[0].id,
                  (err) => {
                    if (err)
                      return this.emit('pollingError', err);
                    this.getQueryResult()
                      .on('data', () => {
                        clearInterval(this.intervalId);
                        this.emit('finalState', this.state);
                      })
                      .on('error', (err) => {
                        this.emit('pollingError', err);
                      });
                  });
              } else {
                clearInterval(this.intervalId);
                this.emit('finalState', this.state);
              }
            } else {
              this.emit('currentState', this.state);
            }

          });
        });
      }, 3000);
    }
  }

  isJobFinalState() {
    return this.state.jobInfo &&
      (
        this.state.jobInfo.state === 'Closed' ||
        this.state.jobInfo.state === 'Aborted' ||
        this.state.jobInfo.state === 'Failed'
      );
  }

  isBatchFinalState() {
    if (!this.isJobFinalState()) {
      return false;
    }
    let rv = true;
    this.state.batchInfos.forEach((bi) => {
      if (bi.state === 'Queued' || bi.state === 'InProgress') {
        rv = false;
      }
    });
    return rv;
  }

  log(replacer, space) {
    console.log(this.toString(replacer, space));
  }

  toString(replacer, space) {
    return `BulkApi Options: ${JSON.stringify(this.options, replacer, space)} State: ${JSON.stringify(this.state, replacer, space)}`;
  }

  batchUrl() {
    return `${this.options.loginUrl}/services/async/${this.options.apiVersion}/job/${this.state.jobInfo.id}/batch`;
  }

  jobUrl() {
    return `${this.options.loginUrl}/services/async/${this.options.apiVersion}/job`;
  }

  loginUrl() {
    return `${this.options.loginUrl}/services/Soap/u/${this.options.apiVersion}`;
  }

  loginXml() {
    return `<?xml version="1.0" encoding="utf-8" ?>
    <env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
      <env:Body>
        <n1:login xmlns:n1="urn:partner.soap.sforce.com">
          <n1:username>${this.options.username}</n1:username>
          <n1:password>${this.options.password + this.options.token}</n1:password>
        </n1:login>
      </env:Body>
    </env:Envelope>`;
  }

  query(soql, cb) {
    if (!cb) cb = () => {};
    this.init((err, results) => {
      if (err) return cb(err, results);
      request.post({
        url: this.batchUrl(),
        headers: {
          'X-SFDC-Session': this.state.loginResults.sessionId[0]
        },
        gzip: true,
        body: soql
      }, (err, httpResponse, body) => {
        if (err) return cb(err, results);
        // We can't speicfy json: true to request because the request is a
        // string and SF gets messed up if you tell it it's JSON. So request
        // doesn't automatically parse the body into JSON for us.
        body = JSON.parse(body);
        if (body.exceptionCode) {
          cb(new Error(`query ${JSON.stringify(body)}`));
        } else {
          this.closeJob();
          this.state.batchInfos.push(body);
          cb(err, body);
        }
      });
    });
    return this;
  }

  getQueryResult(batchId, resultId, cb) {
    batchId = batchId || this.state.batchInfos[0].id;
    resultId = resultId || this.state.queryBatchResults[0];
    let handler = (err, httpResponse, body) => {
      // NOT checking for body.exceptionCode so that callback is consistent
      // with stream. You have to check the actual response data to see if
      // there was an non HTTP error.
      cb(err, body);
    };
    if (!cb) {
      // handler = null doesn't work.
      handler = undefined;
    }
    return request.get({
      url: `${this.batchUrl()}/${batchId}/result/${resultId}`,
      headers: {
        'X-SFDC-Session': this.state.loginResults.sessionId[0]
      },
      gzip: true,
      json: true
    }, handler);
  }

  // For bulk queries batch result will look like this
  // [ '7525B0000006RFK' ]
  // For PK chunking queries there will be multiple IDs in the array.

  // For inserts, updates, deletes it will look something like
  // [ {
  //   "success" : true,
  //   "created" : true,
  //   "id" : "0015B000005cvHDQAY",
  //   "errors" : [ ]
  // }, {
  //   "success" : true,
  //   "created" : true,
  //   "id" : "0015B000005cvHEQAY",
  //   "errors" : [ ]
  // } ]
  // Best to cache the request locally so you don't have to re-get it from SF.
  getBatchResult(batchId, cb) {
    return this.getBatchRr(batchId, 'result', cb);
  }

  getBatchRequest(batchId, cb) {
    return this.getBatchRr(batchId, 'request', cb);
  }

  // For really small requests it may make sense to pass a callback (cb).
  // Generally you are going to want this to return a stream.
  // In which case don't pass the cb.
  getBatchRr(batchId, requestResult, cb) {
    let handler = (err, httpResponse, body) => {
      // NOT checking for body.exceptionCode so that callback is consistent
      // with stream. You have to check the actual response data to see if
      // there was an non HTTP error.
      if (this.state.jobInfo.operation === 'query' && requestResult === 'result') {
        // ??? TODO XXX can there be many batch result ids for a single batch
        // query ???
        this.state.queryBatchResults = body;
      }
      cb(err, body);
    };
    if (!cb) {
      // handler = null doesn't work.
      handler = undefined;
    }
    return request.get({
      url: `${this.batchUrl()}/${batchId}/${requestResult}`,
      headers: {
        'X-SFDC-Session': this.state.loginResults.sessionId[0]
      },
      gzip: true,
      json: true
    }, handler);
  }

  closeJob(cb) {
    this.closeAbortJob('Closed', cb);
  }

  abortJob(cb) {
    this.closeAbortJob('Aborted', cb);
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_jobs_close.htm
  // state: Closed | Aborted
  closeAbortJob(state, cb) {
    if (!cb) cb = () => {};
    if (!this.state.jobInfo)
      return process.nextTick(cb, null, 'INFO: No job exists. Nothing to do.');
    if (this.state.jobInfo.state === 'Queued')
      return setTimeout(() => {
        this.getJobInfo((err) => {
          if (err) return cb(err);
          this.closeAbortJob(state, cb);
        });
      }, 500);
    // Queued check must come before Open check.
    if (this.state.jobInfo.state !== 'Open')
      return process.nextTick(cb, null,
        `INFO: Job is already ${this.state.jobInfo.state}.`);
    request.post({
      url: `${this.jobUrl()}/${this.state.jobInfo.id}`,
      headers: {
        'X-SFDC-Session': this.state.loginResults.sessionId[0]
      },
      gzip: true,
      json: {
        state: state
      }
    }, (err, httpResponse, body) => {
      if (err) return cb(err);
      if (body.exceptionCode) {
        cb(new Error(`changeJobState: ${state} ${JSON.stringify(body)}`));
      } else {
        this.state.jobInfo = body;
        cb(null, this.state.jobInfo);
      }
    });
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_batches_get_info.htm
  getBatchInfo(batchId, cb) {
    if (!cb) cb = () => {};
    process.nextTick(cb,
      new Error(`getBatchInfo(batchId, cb) not yet implemented.`));
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_batches_get_info_all.htm
  getBatchInfos(cb) {
    if (!cb) cb = () => {};
    if (this.state.batchInfos.length === 0 || this.isBatchFinalState()) {
      return process.nextTick(cb, null, this.state.batchInfos);
    }
    request.get({
      url: this.batchUrl(),
      headers: {
        'X-SFDC-Session': this.state.loginResults.sessionId[0]
      },
      gzip: true,
      json: true
    }, (err, httpResponse, body) => {
      if (err) return cb(err);
      if (body.exceptionCode) {
        cb(new Error(`getBatchInfo ${JSON.stringify(body)}`));
      } else {
        this.state.batchInfos = body.batchInfo;
        cb(err, this.state.batchInfos);
      }
    });
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_jobs_get_details.htm
  getJobInfo(cb) {
    if (!cb) cb = () => {};
    if (!this.state.jobInfo || this.isJobFinalState()) {
      return process.nextTick(cb, null, this.state.jobInfo);
    }
    request.get({
      url: `${this.jobUrl()}/${this.state.jobInfo.id}`,
      headers: {
        'X-SFDC-Session': this.state.loginResults.sessionId[0]
      },
      gzip: true,
      json: true
    }, (err, httpResponse, body) => {
      if (err) return cb(err);
      if (body.exceptionCode) {
        cb(new Error(`getJobInfo ${JSON.stringify(body)}`));
      } else {
        this.state.jobInfo = body;
        cb(null, this.state.jobInfo);
      }
    });
  }

  // Add a Batch to a Job
  // AKA send a new batch of records to SF to be inserted, updated, deleted, etc.
  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_batches_create.htm
  addBatch(records, cb) {
    if (!cb) cb = () => {};
    if (records.length === 0) return process.nextTick(cb);
    this.init((err) => {
      if (err) return cb(err);
      if (this.state.jobInfo.state !== 'Open')
        return cb(new Error('Invalid job state: ' + this.state.jobInfo.state));
      request.post({
        url: this.batchUrl(),
        json: true,
        headers: {
          'X-SFDC-Session': this.state.loginResults.sessionId[0]
        },
        gzip: true,
        body: records
      }, (err, httpResponse, body) => {
        if (err) return cb(err);
        if (body.exceptionCode) {
          cb(new Error(`addBatch ${JSON.stringify(body)}`));
        } else {
          this.state.batchInfos.push(body);
          cb(null, body);
        }
      });
    });
  }

  init(cb) {
    if (!cb) cb = () => {};
    this.login((err) => {
      if (err) return cb(err);
      this.createJob(cb);
    });
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_jobs_create.htm
  createJob(cb) {
    if (!cb) cb = () => {};
    if (this.state.jobInfo)
      return process.nextTick(cb, null, this.state.jobInfo);
    request.post({
      url: this.jobUrl(),
      headers: {
        'X-SFDC-Session': this.state.loginResults.sessionId[0]
      },
      gzip: true,
      json: {
        operation: this.options.operation,
        object: this.options.object,
        externalIdFieldName: this.options.externalIdFieldName,
        contentType: this.options.contentType,
        concurrencyMode: this.options.concurrencyMode
      }
    }, (err, httpResponse, body) => {
      if (err) return cb(err);
      if (body.exceptionCode) {
        cb(new Error(`createJob ${JSON.stringify(body)}`));
      } else {
        this.state.jobInfo = body;
        cb(err, this.state.jobInfo);
      }
    });
  }

  // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_quickstart_login.htm
  login(cb) {
    if (!cb) cb = () => {};
    if (this.state.loginResults)
      return process.nextTick(cb, null, this.state.loginResults);
    request.post({
      url: this.loginUrl(),
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': 'login'
      },
      gzip: true,
      body: this.loginXml()
    }, (err, httpResponse, body) => {
      if (err) return cb(err);
      parseString(body, (err, result) => {
        if (err) return cb(err);
        try {
          this.state.loginResults = result['soapenv:Envelope']['soapenv:Body']
            [0].loginResponse[0].result[0];
          cb(null, this.state.loginResults);
        } catch (err) {
          cb(new Error(JSON.stringify(result)));
        }
      });
    });
  }
}

exports = module.exports = BulkApi;