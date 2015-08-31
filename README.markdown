Thermite
========

[![Build Status](https://secure.travis-ci.org/omphalos/thermite.png)
](http://travis-ci.org/omphalos/thermite)
[![Coverage](https://coveralls.io/repos/omphalos/thermite/badge.svg)
](https://coveralls.io/github/omphalos/thermite)

[![Browser Support](https://saucelabs.com/browser-matrix/omphalos_thermite.svg)
](https://saucelabs.com/u/omphalos_thermite)

Thermite gives you an API for programmatically live reloading code.

Its main purpose is to act like a library used by
development and (experimentally) deployment tools.

Comparison with V8's live code reloading
----------------------------------------

I like V8 and use it in normal development.
Nevertheless there are advantages to doing live code reloading with a library.

* V8 runtimes are currently the only ones that support live code reloading
(AFAIK),
so if you want to do this in another browser,
you're out of luck.
* V8 requires the user to start a debugging session
and doesn't provide a way to hot swap from the program itself.

Thermite doesn't have these restrictions.

I'm not complaining about V8 - I love it.
But I think there's utility
in having a library available that hot-swaps code cross-browser.

Set Up
------

If you are using Node, first, `npm install thermite`,
then `var thermite = require('thermite')`

If you are using the browser, `thermite` is exposed as a global variable.

Basic usage
-----------

    var hotSwappableCode = thermite.eval('(' + function multiply(x, y) {
      return x * y
    } + ')')

    hotSwappableCode.update('(' + function add(x, y) {
      return x + y
    } + ')')

    hotSwappableCode.result(2, 3) // returns 5

Note that thermite doesn't just replace one reference to a function,
it effectively replaces all references to functions and closures as well.

For example:

    var hotSwappableCode = thermite.eval('(' + function() {
      document.addEventListener("mousemove", function(evt) {
        console.log(evt.clientX * evt.clientY)
      })
    } + ')()')

    hotSwappableCode.update('(' + function() {
      document.addEventListener("mousemove", function(evt) {
        console.log(evt.clientX + evt.clientY)
      })
    } + ')()')

Calling `update` here doesn't add a second event listener to the DOM.
It effectively replaces the reference to the event listener stored in the DOM
with a new one.

Tests
-----

To test, clone the repo and run `npm install` then `npm test`.

How it works
------------

Thermite works by rewriting code
and proxying each function.

Additionally it stores the initial version of your code in a map.

When you call `update`,
thermite runs a diff to identify how functions change during the update.
It uses this diff to update the map.

Whenever a function runs, it checks its version.
When a function finds that its version is lower than the one in the map,
it `evals` the new function (creating it in the proper scope).

License
-------

MIT
