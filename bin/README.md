# bin

So this folder is a bit strange.

## Why .js files don't have a .js extension

The idea is that I wanted to be able to install this globally with `npm install
-g`. And I also want to clients to be able to use it locally with exactly the
same commands. The only difference would be setting your path to use it locally.

Here is how a client app who installed us locally would call these scripts.

```
#!/usr/bin/env bash
set -e
export PATH=./node_modules/sf-data-loader/bin:$PATH
sfexport 'select Id from Contact' | sfdelete Contact
```

If we are installed globally, you can just get rid of the `export PATH ...`. In
order for this to work the javascript files `bin/sfexport` etc can't have the
`.js` extension.

See the snipped from `package.json` below. This defines the global command names
and the executable in our project that the names point to.

```
  "bin": {
    "sfexport": "./bin/sfexport",
    "sfinsert": "./bin/sfinsert",
    "sfupdate": "./bin/sfupdate",
    "sfupsert": "./bin/sfupsert",
    "sfdelete": "./bin/sfdelete"
  },
```

It's not possible to say `"sfexport.js": "./bin/sfexport.js",`. Specifically the
first bit `sfexport` which defines the command name can't have an extension. So
if we want it to work the same both globally and locally, neither one can have
an extension.

## Working in Windoze

We added `.cmd` files for each so the will also run locally in Windows. When you
do a global `npm` install, `npm` itself will generate similar `.cmd` files on
the global npm path.
