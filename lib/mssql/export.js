#!/usr/bin/env node

'use strict';

const mssql = require('mssql');
const stream = require('stream');
const fs = require('fs');

// "Readable" that queries Microsoft SQL Server. Returns results in JSON.

// options.sql a string SQL query or a file that contains a SQL query.

// options.mssql driver information for SQL server.

// mssql: {
//   server: 'foo.us-east-1.rds.amazonaws.com',
//   port: 1433,
//   database: 'rdsadmin',
//   user: 'someuser',
//   password: '*****',
//   stream: true // You can enable streaming globally or per request
// }
class ReadableWrapper extends stream.Transform {
  constructor(options) {
    super({
      objectMode: true,
      highWaterMark: 2
    });
    this.options = options;
    this._init();
  }
  _getSql(cb) {
    if (this.options.sql.toLowerCase().startsWith('select')) {
      cb(null, this.options.sql);
    } else {
      // Assume it's a file name.
      fs.readFile(this.options.sql, cb);
    }
  }
  _init() {
    this._getSql((err, sql) => {
      if (err) return this.emit('error', err);
      sql = sql.trim();
      let connection = new mssql.Connection(
        this.options.mssql,
        (err) => {
          if (err) return this.emit('error', err);
          const request = new mssql.Request(connection);
          const query = request.query(sql);
          this.listeners('error').forEach((l) => {
            query.on('error', l);
          });
          query.on('error', () => {
            connection.close();
          });
          this.on('finish', () => {
            connection.close();
          });
          query.pipe(this);
        });
    });
  }
  _transform(data, encoding, callback) {
    // Nothing special to do here just pass along the data.
    this.push(data);
    callback();
  }
}

exports = module.exports = ReadableWrapper;