#!/usr/bin/env node

'use strict';

// Stream unlimited rows into a Sql Server table.

// Source stream must be an object stream. Object property names must match
// table column names. Since SQL Server isn't case sensitive, don't think case
// matters. Object data types must match column data types. See  'JS Data Type
// To SQL Data Type Map' https://github.com/patriksimek/node-
// mssql/tree/12255523f892d72d440f06d1ee86a2b214961db1

const mssql = require('mssql');
const stream = require('stream');

class MsSqlInsert extends stream.Transform {
  constructor(options) {
    super({
      objectMode: true
    });
    this.options = options;
    // REQUIRED this.options.tableName
    // REQUIRED this.options.mssql
    // {
    //   driver: 'msnodesqlv8',
    //   server: 'MY_SERVER',
    //   database: 'SomeDb',
    //   stream: true, // You can enable streaming globally or per request
    //   options: {
    //     trustedConnection: true,
    //     encrypt: true
    //   }
    // }
    // REQUIRED this.options.tableDefinition
    // [
    //   [ 're_legacy_id', mssql.Int, { nullable: false }],
    //   [ 'sf_id', mssql.VarChar(18), { nullable: false }],
    //   [ 're_constiuent_id', mssql.VarChar(20), { nullable: true }]
    // ]
    // verbose causes mssql to log stuff.
    // this.options.verbose;
    this.options.batchSize = this.options.batchSize || 1000;
    // If true we will drop and create table before insert.
    // this.options.dropCreate = false;
    this.state = {};
    this.state.connection = null;
    this.state.connected = false;
    this.state.tableDropped = false;
    this.state.intervalId = null;
    this.state.rows = [];
  }

  // Turn row which is an object into an array of it's values in the proper
  // sequence (as they are listed in the colNames array).
  _rowToArray(colNames, row) {
    const a = [];
    colNames.forEach((name) => {
      a.push(row[name]);
    });
    return a;
  }

  // OK, we're sending the rows to good old microsoft.
  _sendRows(cb) {
    const table = new mssql.Table(this.options.tableName);
    table.create = true;
    const colNames = [];
    // table.columns.add('re_id', mssql.VarChar(77), {
    //   nullable: false
    // });
    this.options.tableDefinition.forEach((def) => {
      colNames.push(def[0]);
      table.columns.add.apply(table.columns, def);
    });
    // this.state.rows.forEach((row) => {
    //   table.rows.add(`REID_${ix++}`, `SFID_${ix}`);
    // });
    this.state.rows.forEach((row) => {
      let rowA = this._rowToArray(colNames, row);
      table.rows.add.apply(table.rows, rowA);
    });
    const request = new mssql.Request(this.state.connection);
    request.verbose = this.options.verbose;
    request.bulk(table)
      .on('done', () => {
        this.state.rows = [];
        if (this.state.flush) {
          this.state.connection.close();
        }
        cb();
      })
      .on('error', (err) => {
        this.state.connection.close();
        cb(err);
      });
  }
  _dropTableIfNecessary(cb) {
    if (!this.options.dropCreate || this.state.tableDropped) {
      process.nextTick(cb);
    } else {
      // For some stupid reason you need to attach an on error event to
      // request. You are supposed to be able to do the callback style and
      // handle error, but it complains that there's no error handler if you
      // try that.
      const request = new mssql.Request(this.state.connection);
      request.verbose = this.options.verbose;
      request.batch(`IF OBJECT_ID('${this.options.tableName}', 'U') IS NOT NULL
DROP TABLE ${this.options.tableName}`)
        .on('done', () => {
          this.state.tableDropped = true;
          cb();
        })
        .on('error', (err) => {
          this.state.connection.close();
          cb(err);
        });
    }
  }
  _makeConnectionIfNecessary(cb) {
    if (this.state.connected) {
      process.nextTick(cb);
    } else {
      // For some stupid reason you need to attach an on error event to
      // connection. You are supposed to be able to do the callback style and
      // handle error, but it complains that there's no error handler if you
      // try that.
      this.state.connection = new mssql.Connection(
        this.options.mssql,
        (err) => {
          if (err) {
            cb(err);
          } else {
            this.state.connected = true;
            cb();
          }
        });
    }
  }
  _sendBatch(cb) {
    if (this.state.rows.length === 0) {
      // this will only happen if we were called by _flush and there just
      // happen to be no remainder in the buffer.
      process.nextTick(cb);
    } else {
      this._makeConnectionIfNecessary((err) => {
        if (err) {
          cb(err);
        } else {
          this._dropTableIfNecessary((err) => {
            if (err) {
              this.state.connection.close();
              cb(err);
            } else {
              this._sendRows(cb);
            }
          });
        }
      });
    }
  }

  // Built in node stream method used internally to send us data.
  _transform(object, encoding, cb) {
    this.state.rows.push(object);
    if (this.state.rows.length === this.options.batchSize) {
      this._sendBatch(cb);
    } else {
      cb();
    }
  }

  _flush(cb) {
    this.state.flush = true;
    this._sendBatch(cb);
  }
}

exports = module.exports = MsSqlInsert;