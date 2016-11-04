#!/usr/bin/env node

'use strict';

const mssql = require('mssql');
const MsSqlInsert = require('../lib/mssql/insert');
const options = require('../config');
// const Readable = require('stream').Readable;
const es = require('event-stream');

options.verbose = true;
options.dropCreate = true;
options.tableName = 'sf_contact';
options.tableDefinition = [
  ['re_legacy_id', mssql.Int, {
    nullable: false
  }],
  ['sf_id', mssql.VarChar(18), {
    nullable: false
  }],
  ['re_constiuent_id', mssql.VarChar(20), {
    nullable: true
  }]
];

const a = [];
for (let i = 0; i < 7; i++) {
  a.push({
    re_legacy_id: i,
    sf_id: `sf_id_${i}`,
    re_constiuent_id: `re_constiuent_id_${i}`
  });
}

es.readArray(a)
  .pipe(new MsSqlInsert(options));