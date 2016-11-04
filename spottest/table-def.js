#!/usr/bin/env node

'use strict';

const mssql = require('mssql');

exports = module.exports = [
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