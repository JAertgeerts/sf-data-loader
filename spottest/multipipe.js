#!/usr/bin/env node

'use strict';
const stream = require('stream');
const multipipe = require('multipipe');

// This is just a very unreliable test readable stream.
const readable = new stream.Readable({
  objectMode: true,
  read() {
    for (let i = 0; i < 10; i++) {
      if (new Date().getTime() % 7 === 1) {
        this.__err = new Error('READABLE ERROR');
        this.emit('error', this.__err);
        return;
      }
      this.push({
        Name: `Mikey ${i}`
      });
    }
    this.push(null);
  }
});

// This is just a very unreliable test writable stream.
const writable = new stream.Writable({
  objectMode: true,
  write(chunk, encoding, callback) {
    console.log(chunk, encoding);
    if (new Date().getTime() % 5 === 1) {
      callback(new Error('WRITABLE ERROR'));
    } else {
      callback();
    }
  }
});

// Transform stream that does nothing.
const transform = new stream.PassThrough({
  objectMode: true
});

// Just another example node's poor error handling workflow.

// Node doesn't propagate handlers up the chain on pipe, so you have to do
// the following which is insanity.

// readable.on('error', handler)
//   .pipe(transform1).on('error', handler)
//   .pipe(transform2).on('error', handler)
//   .pipe(transform3).on('error', handler)
//   .pipe(writable).on('error', handler);

// There isn't a soul in the universe that wants to do this. There may be times
// you need to do it, but you don't want to be forced to do it all the time.

// We would like to do this.

// readable
//   .pipe(transform1)
//   .pipe(transform2)
//   .pipe(transform3)
//   .pipe(writable)
//   .on('error', handler);

// Multipipe to the rescue. 3.5 million downloads a month can't be wrong, right?
// By comparison mikeal's request has 18 million a month.

// If you care about when the stream is done it seems you need to use the
// callback.

multipipe(readable, transform, writable, (err) => {
  if (err) {
    return console.log('ERROR', err);
  }
  console.log('FINISH');
});

// OK this is a beef I have with multipipe. You don't get a finish event.
// The following does not work.

// multipipe(readable, transform, writable)
//   .on('error', (err) => {
//     console.log('ERROR', err);
//   })
//   .on('finish', () => {
//     console.log('FINISH');
//   });

// This doesn't work, and it's crazy anyway.
// let chain = readable.pipe(transform).pipe(writable).on('finish', () => {
//   console.log('FINISH');
// });
// multipipe(chain).on('error', (err) => {
//   console.log('ERROR', err);
// });

// You can create a partial chain and then add to it later. Still all your error
// and success handling is in a single place. You can even prepend a readable,
// which is nice for readable wrapping transform streams.

// let partialChain = multipipe(transform, writable, (err) => {
//   if (err) {
//     return console.log('ERROR', err);
//   }
//   console.log('FINISH');
// });
// multipipe(readable, partialChain);

