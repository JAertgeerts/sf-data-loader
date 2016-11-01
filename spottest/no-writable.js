#!/usr/bin/env node

'use strict';

// This test shows that you don't have to end a stream with a writable. Not sure
// why you would even need a writble. Transform streams are more flexible.

// transform { Name: 'Frank 0' }
// transform { Name: 'Frank 1' }
// transform { Name: 'Frank 2' }
// transform { Name: 'Frank 3' }
// transform { Name: 'Frank 4' }
// transform { Name: 'Frank 5' }
// flush
// finish

const stream = require('stream');

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

const transform = new stream.Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    console.log('transform', chunk);
    callback();
  },
  flush(callback) {
    console.log('flush');
    callback();
  }
});

readable
  .pipe(transform)
  .on('finish', () => {
    console.log('finish');
  })
  .on('error', (err) => {
    console.log('error', err);
  });