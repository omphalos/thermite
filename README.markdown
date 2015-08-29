Thermite
========

[![Build Status](https://secure.travis-ci.org/omphalos/thermite.png)
](http://travis-ci.org/omphalos/thermite)
[![Browser Support](https://ci.testling.com/omphalos/thermite.png)
](https://ci.testling.com/omphalos/thermite)

Thermite gives you an API for programmatically live reloading code.

Its main purpose is to act like a library used by
development and (experimentally) deployment tools.

It works cross-browser and in Node.
This means you can live reload code while users are browsing your page,
no matter what browser they use.
Additionally, this provides hot swapping capability across runtimes.

Comparison with V8's live code reloading
----------------------------------------

I like V8 and use it in normal development.
Nevertheless there are advantages to doing live code reloading with a library.

* V8 runtimes are currently the only ones that support live code reloading
(AFAIK),
so if you want to do this in another browser,
you're out of luck.
* V8 requires the user to start a debugging session.
* V8 doesn't provide a way to hot swap from the program itself.

Thermite doesn't have any of these restrictions.

I'm not complaining about V8 - I love it.
But I think there's utility
in having a cross-platform live code reloading library.

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

    var hotSwappableCode = thermite.eval([
      'document.addEventListener("mousemove", function(evt) {',
      '  console.log(evt.clientX * evt.clientY)'
      '}'
    '}'].join('\n'))

    hotSwappableCode.update([
      'document.addEventListener("mousemove", function(evt) {',
      '  console.log(evt.clientX + evt.clientY)'
      '}'
    '}'].join('\n'))

Calling `update` here doesn't add a second event listener to the DOM.
It effectively replaces the reference to the event listener stored in the DOM
with a new one.

Live Example
------------

The live example shows more stuff.
See it [here](#todo).

Tests
-----

To test, clone the repo and run `npm install` then `npm test`.

How it works
------------

Thermite works by instrumenting code
and saving references to each function.
It invokes `eval` in scope to ensure that scope is preserved.

When code updates,
thermite runs a diff and tries match each function.
Updated functions lazily invoke `eval` in the proper scope,
as they are called,
replacing old functions.

License
-------

MIT
