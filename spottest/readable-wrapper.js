#!/usr/bin/env node

'use strict';

const stream = require('stream');

// This is an example of a 'readable' stream that has to go through a multi-
// step process to finally get the actual readable stream. So we are
// asynchronously wrapping another readable stream.

// The key to simplicity here was to use a transform stream instead of a
// readable stream because it allows us to pipe the stream to ourselves.
class ReadableWrapper extends stream.Transform {
  constructor() {
    super({
      objectMode: true,
      // Our _transform method doesn't really do anything and we don't want to
      // hog up any more additional memory than necessary.
      highWaterMark: 1
    });
    process.nextTick(() => {
      if (new Date().getTime() % 5 === 1) {

        // Here we simulate an error that happened somewhere in the multi-step
        // process to get the final stream. So we just emit 'error' and we're
        // done.
        this.emit('error', new Error('Could not get the stream.'));

        //Assuming based on the node docs that we should not emit
        // 'close' or 'end' on error. If we do emit 'end', it will trigger the
        // writable's 'finish' event, which is probably not desired. You either
        // want an 'error' OR a 'finish'.

        // NODE END EVENT DOCS
        // The 'end' event is emitted when there is no more data to be consumed
        // from the stream.

        // Note: The 'end' event will not be emitted unless the data is
        // completely consumed. This can be accomplished by switching the stream
        // into flowing mode, or by calling stream.read() repeatedly until all
        // data has been consumed.

        // this.emit('end');

        // NODE CLOSE EVENT DOCS
        // The 'close' event is emitted when the stream and any of its
        // underlying resources (a file descriptor, for example) have been
        // closed. The event indicates that no more events will be emitted, and
        // no further computation will occur.

        // Not all Readable streams will emit the 'close' event.

        // this.emit('close');
      } else {
        // We successfully got the stream we wanted after a long, hard, multi-
        // step process, so first we need to copy all our listeners over to it
        // -- NOT.

        // ['close', 'data', 'end', 'error'].forEach((eventName) => {
        //   this.listeners(eventName).forEach((l) => {
        //     readable.on(eventName, l);
        //   });
        // });

        // Turns out that .pipe propagates ALL listeners EXCEPT the 'error'
        // listener. What's up with that !?! If we copy any of the others  we
        // get double the events -- including double the data. So here we just
        // copy over the 'error' listener to make sure we get 'error' events.
        ['error'].forEach((eventName) => {
          this.listeners(eventName).forEach((l) => {
            readable.on(eventName, l);
          });
        });

        // Then just pipe it to ourselves, and we are good.
        readable
          .pipe(this);
      }
    });
  }
  _transform(data, encoding, callback) {
    // Nothing special to do here just pass along the data.
    this.push(data);
    callback();
  }
}

// This is just a very unreliable test readable stream.
const readable = new stream.Readable({
  objectMode: true,
  read() {
    for (let i = 0; i < 10; i++) {
      if (new Date().getTime() % 13 === 1) {
        this.__err = new Error('Sorry, error reading data.');
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
    if (new Date().getTime() % 3 === 1) {
      callback(new Error('WRITABLE ERROR'));
    } else {
      callback();
    }
  }
});

new ReadableWrapper()
  // if your stream emits close you get close.
  .on('close', () => {
    console.error('CLOSE');
  })
  // if you push null you get end from read.
  .on('end', () => {
    console.error('END');
  })
  // error needs to be both places !?! seriously node?
  .on('error', (error) => {
    console.error('ERROR', error);
  })
  // Finish does no good here. It's a writable event.
  // .on('finish', () => {
  //   console.error('FINISH');
  // })
  .pipe(writable)
  // Close and End do no good here, they are readable events.
  // They are not propagated to the writable.
  //
  // // if your stream emits close you get close.
  // .on('close', () => {
  //   console.error('CLOSE');
  // })
  // // if you push null you get end from read.
  // .on('end', () => {
  //   console.error('END');
  // })
  // error needs to be both places !?! seriously node?
  .on('error', (error) => {
    console.error('ERROR', error);
  })
  // you should always get either finish or error or something was done
  // incorrectly.
  .on('finish', () => {
    console.error('FINISH');
  });