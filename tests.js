#!/usr/bin/env node

'use strict'

var test = require('tape')
var thermite = require('./thermite.js')

/////////////////////
// Test basic eval //
/////////////////////

test('should eval raw JavaScript', function(t) {
  t.equal(thermite.eval('123').result, 123)
  t.end()
})

test('should eval an anonymous function', function(t) {
  var fn = thermite.eval('(' + function() { return 123 } + ')').result
  t.equal(fn(), 123)
  t.end()
})

test('should eval a named function', function(t) {
  var fn = thermite.eval('(' + function x() { return 123 } + ')').result
  t.equal(fn(), 123)
  t.equal(fn.name, 'x')
  t.end()
})

test('should eval in scope', function(t) {
  var x = 123
  thermite.eval('x = 5', {
    eval: function(code) { return eval(code) }
  })
  t.equal(x, 5)
  t.end()
})

/////////////////////////////
// Test basic hot swapping //
/////////////////////////////

test('should replace functions', function(t) {
  var target = thermite.eval('(' + function noop() {} + ')')
  target.update('(' + function add(x, y) { return x + y } + ')')
  t.equal(target.result(2, 3), 5)
  t.end()
})

test('should replace multiline functions', function(t) {
  var target = thermite.eval('(' + function noop() {} + ')')
  target.update('(' + function add(x, y) {
    return x + y
  } + ')')
  t.equal(target.result(2, 3), 5)
  t.end()
})

test('should update function references', function(t) {
  var target = thermite.eval('(' + function() {} + ')')
  var savedReference = target.result
  target.update('(' + function add(x, y) { return x + y } + ')')
  t.equal(savedReference(2, 3), 5)
  t.end()
})

test('should update recursive-style function references', function(t) {
  var target = thermite.eval('(' + function length(x) {
    return x ? rec(x.tail) + 1 : 0
  } + ')')
  var savedReference = target.result
  target.update('(' + function lengthPlus100(x) {
    return x ? lengthPlus100(x.tail) + 1 : 100
  } + ')')
  t.equal(savedReference({ tail: { tail: {} } }), 103)
  t.end()
})

test('should hot swap nested functions', function(t) {
  var target = thermite.eval('(' + function outer() {
    return 'outer-' + inner()
    function inner() { return 'inner' }
  } + ')')
  var savedReference = target.result
  target.update('(' + function outer() {
    return 'outerChanged-' + inner()
    function inner() { return 'innerChanged' }
  } + ')')
  t.equal(savedReference(), 'outerChanged-innerChanged')
  t.end()
})

test('should add functions', function(t) {
  var target = thermite.eval('(' + function outer() {
    return function inner() {}
  } + ')')
  var outer = target.result
  target.update('(' + function outer() {
    return function inner1() {
      return function inner2() { return 'inner2Result' }
    }
  } + ')')
  var inner1 = outer()
  var inner2 = inner1()
  var inner2Result = inner2()
  t.equal(inner2Result, 'inner2Result')
  t.end()
})

test('should update added functions', function(t) {
  var target = thermite.eval('(' + function outer() {
    return function inner() {}
  } + ')')
  var outer = target.result
  target.update('(' + function outer() {
    return function inner1() {
      return function inner2() { return 'inner2Result' }
    }
  } + ')')
  target.update('(' + function outer() {
    return function inner1() {
      return function inner2() { return 'inner2ResultChanged' }
    }
  } + ')')
  var inner1 = outer()
  var inner2 = inner1()
  var inner2Result = inner2()
  t.equal(inner2Result, 'inner2ResultChanged')
  t.end()
})

test('should update added functions 10 times', function(t) {
  var target = thermite.eval('(' + function outer() {
    return function inner() {}
  } + ')')
  var outer = target.result
  for(var i = 0; i < 10; i++)
    target.update(('(' + function outer() {
      return function inner1() { return function inner2() { return i } }
    } + ')').replace('return i', 'return ' + i))
  var inner1 = outer()
  var inner2 = inner1()
  var inner2Result = inner2()
  t.equal(inner2Result, 9)
  t.end()
})

test('should update function twice', function(t) {
  var target = thermite.eval('(' + function outer() {
    return function inner() {}
  } + ')')
  var outer = target.result
  target.update('(' + function outer() {
    return function inner() { return 1 }
  } + ')')
  target.update('(' + function outer() {
    return function inner() { return 2 }
  } + ')')
  var inner = outer()
  t.equal(inner(), 2)
  t.end()
})

test('should update 10 times', function(t) {
  var target = thermite.eval('(' + function outer() {
    return function inner() {}
  } + ')')
  var outer = target.result
  for(var i = 0; i < 10; i++)
    target.update(('(' + function outer() {
      return function inner() { return i }
    } + ')').replace('return i', 'return ' + i))
  var inner = outer()
  t.equal(inner(), 9) // The last value of `i` is 9.
  t.end()
})

test('should update member functions', function(t) {
  var target = thermite.eval('(' + function() {
    return { fn: function() {} }
  } + ')')
  var fn = target.result().fn
  target.update('(' + function() {
    return { fn: function() { return 'updated' } }
  } + ')')
  t.equal(fn(), 'updated')
  t.end()
})

test('should update all copies of a function', function(t) {
  var target = thermite.eval('(' + function() {
    return function() {}
  } + ')')
  var fn1 = target.result()
  var fn2 = target.result()
  target.update('(' + function() {
    return function() { return 'updated' }
  } + ')')
  t.equal(fn1(), 'updated')
  t.equal(fn2(), 'updated')
  t.end()
})

test('should update recursive function references', function(t) {
  var recursiveReference

  var target = thermite.eval('(' + function rec(x) {
    recursiveReference = recursiveReference || rec
    return x ? recursiveReference(x.tail) + 1 : 0
  } + ')', {
    eval: function(code) {
      // Pass eval so that the function can access recursiveReference
      return eval(code)
    }
  })

  // Call the function so that recursiveReference gets set
  target.result()

  // Replace this with a new calculation
  target.update('(' + function rec(x) {
    return x ? rec(x.tail) + 1 : 100
  } + ')')

  t.equal(recursiveReference({ tail: { tail: {} } }), 103)
  t.end()
})
