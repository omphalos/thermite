Thermite
========

[![Build Status](https://secure.travis-ci.org/omphalos/thermite.png)
](http://travis-ci.org/omphalos/thermite)
[![Coverage](https://coveralls.io/repos/omphalos/thermite/badge.svg)
](https://coveralls.io/github/omphalos/thermite)

Thermite gives you an API for programmatically live reloading code.

Its main purpose is to act like a library used by
development and (experimentally) deployment tools.

Comparison with native browser live code reloading
--------------------------------------------------

I love native browser live code reloading and use it in normal development.
Nevertheless there are advantages to doing live code reloading with a library.

* Most runtimes currently do not support live code reloading,
so on many browsers,
if you want this feature,
you're out of luck.
* Browsers that do support this
don't offer direct access to this feature
from inside your program.

Thermite doesn't have these restrictions.

I'm not complaining about native browser reloading - I think it's great.
But I think there's utility
in having a library that gives you
direct programmatic access to hot code swapping cross browser.

Demo
----

The demo is [here](https://omphalos.github.io/thermite).

Check it out!

Set Up
------

If you are using Node, first, `npm install thermite`,
then `var thermite = require('thermite')`

If you are using the browser, use thermite.min.js.
`thermite` is exposed as a global variable.
Or just use browserify.

Basic usage
-----------

    var hotSwappableCode = thermite.eval('(' + function() {
      document.addEventListener("mousemove", function(evt) {
        console.log(evt.clientX * evt.clientY)
      })
    } + ')()')

    hotSwappableCode.hotSwap('(' + function() {
      document.addEventListener("mousemove", function(evt) {
        console.log(evt.clientX + evt.clientY)
      })
    } + ')()')

Calling `hotSwap` here doesn't add a second event listener to the DOM.
It effectively replaces the reference to the event listener stored in the DOM
with a new one.

How it works
------------

Thermite works by rewriting code
and proxying each function.

Additionally it stores the initial version of your code in a map.

When you call `hotSwap`,
thermite runs a diff to identify how functions change.
It uses this diff to update the map.

Whenever a function runs, it checks its version.
When a function finds that its version is lower than the one in the map,
it `evals` the new function (creating it in the proper scope).

License
-------

MIT
