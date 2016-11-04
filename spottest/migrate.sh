#!/usr/bin/env bash
set -e
# Without -o pipefail you only get an error exit code if the very last
# thing you pipe to fails. With -o pipefail you get an error exit code
# no matter which command in the pipe chain fails.
set -o pipefail

#
# This is just an example migrate script.
#
# Super important are the `set -e` and `set -o pipefail`. Unless you have
# both of these, your script will just keep on chugging even if you hit
# an error.
#

#
# If you local install sf-data-loader you can set your path as follows.
# This will allow all commands to work same as if you installed globally.
#
export PATH=./node_modules/sf-data-loader/bin:$PATH

sfexport -s "select id from Account"
