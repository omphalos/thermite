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
  var fn = thermite.eval('(function() { return 123 })').result
  t.equal(fn(), 123)
  t.end()
})

var canReadFunctionNames = (function f() {}).name === 'f'
if(canReadFunctionNames) {
  test('should eval a named function', function(t) {
    var fn = thermite.eval('(function x() { return 123 })').result
    t.equal(fn(), 123)
    t.equal(fn.name, 'x')
    t.end()
  })
}

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
  var target = thermite.eval('(function noop() {})')
  target.hotSwap('(function add(x, y) { return x + y })')
  t.equal(target.result(2, 3), 5)
  t.end()
})

test('should replace multiline functions', function(t) {
  var target = thermite.eval('(function noop() {})')
  target.hotSwap('(function add(x, y) { return x + y })')
  t.equal(target.result(2, 3), 5)
  t.end()
})

test('should hotSwap function references', function(t) {
  var target = thermite.eval('(function() {})')
  var savedReference = target.result
  target.hotSwap('(function add(x, y) { return x + y })')
  t.equal(savedReference(2, 3), 5)
  t.end()
})

test('should hotSwap recursive-style function references', function(t) {
  var target = thermite.eval('(function length(x) {\n'
    + '  return x ? rec(x.tail) + 1 : 0\n'
    + '})')
  var savedReference = target.result
  target.hotSwap('(function lengthPlus100(x) {\n'
    + '  return x ? lengthPlus100(x.tail) + 1 : 100\n'
    + '})')
  t.equal(savedReference({ tail: { tail: {} } }), 103)
  t.end()
})

test('should hot swap nested functions', function(t) {
  var target = thermite.eval('(function outer() {\n'
    + '  return "outer-" + inner()\n'
    + '  function inner() { return "inner" }\n'
    + '})')
  var savedReference = target.result
  target.hotSwap('(function outer() {\n'
    + '  return "outerChanged-" + inner()\n'
    + '  function inner() { return "innerChanged" }\n'
    + '})')
  t.equal(savedReference(), 'outerChanged-innerChanged')
  t.end()
})

test('should add functions', function(t) {
  var target = thermite.eval('(function outer() {\n'
    + '  return function inner() {}\n'
    + '})')
  var outer = target.result
  target.hotSwap('(function outer() {\n'
    + '  return function inner1() {\n'
    + '    return function inner2() { return "inner2Result" }\n'
    + '  }\n'
    + '})')
  var inner1 = outer()
  var inner2 = inner1()
  var inner2Result = inner2()
  t.equal(inner2Result, 'inner2Result')
  t.end()
})

test('should hotSwap added functions', function(t) {
  var target = thermite.eval('(function outer() {\n'
    + '  return function inner() {}\n'
    + '})')
  var outer = target.result
  target.hotSwap('(function outer() {\n'
    + '  return function inner1() {\n'
    + '    return function inner2() { return "inner2Result" }\n'
    + '  }\n'
    + '})')
  target.hotSwap('(function outer() {\n'
    + '  return function inner1() {\n'
    + '    return function inner2() { return "inner2ResultChanged" }\n'
    + '  }\n'
    + '})')
  var inner1 = outer()
  var inner2 = inner1()
  var inner2Result = inner2()
  t.equal(inner2Result, 'inner2ResultChanged')
  t.end()
})

test('should hotSwap added functions 10 times', function(t) {
  var target = thermite.eval('(function outer() {\n'
    + '  return function inner() {}\n'
    + '})')
  var outer = target.result
  for(var i = 0; i < 10; i++)
    target.hotSwap('(function outer() {\n'
      + '  return function inner1() {\n'
      + '    return function inner2() { return ' + i + ' }\n'
      + '  }\n'
      + '})')
  var inner1 = outer()
  var inner2 = inner1()
  var inner2Result = inner2()
  t.equal(inner2Result, 9)
  t.end()
})

test('should hotSwap function twice', function(t) {
  var target = thermite.eval('(function outer() {\n'
    + '  return function inner() {}\n'
    + '})')
  var outer = target.result
  target.hotSwap('(function outer() {\n'
    + '  return function inner() { return 1 }\n'
    + '})')
  target.hotSwap('(function outer() {\n'
    + '  return function inner() { return 2 }\n'
    + '})')
  var inner = outer()
  t.equal(inner(), 2)
  t.end()
})

test('should hotSwap 10 times', function(t) {
  var target = thermite.eval('(function outer() {\n'
    + '  return function inner() {}\n'
    + '})')
  var outer = target.result
  for(var i = 0; i < 10; i++)
    target.hotSwap('(function outer() {\n'
      + '  return function inner() { return ' + i + ' }\n'
      + '})')
  var inner = outer()
  t.equal(inner(), 9) // The last value of `i` is 9.
  t.end()
})

test('should hotSwap member functions', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  return { fn: function() {} }\n'
    + '})')
  var fn = target.result().fn
  target.hotSwap('(function() {\n'
    + '  return { fn: function() { return "hotSwapped" } }\n'
    + '})')
  t.equal(fn(), 'hotSwapped')
  t.end()
})

test('should hotSwap all copies of a function', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  return function() {}\n'
    + '})')
  var fn1 = target.result()
  var fn2 = target.result()
  target.hotSwap('(function() {\n'
    + '  return function() { return "hotSwapped" }\n'
    + '})')
  t.equal(fn1(), 'hotSwapped')
  t.equal(fn2(), 'hotSwapped')
  t.end()
})

test('should hotSwap recursive function references', function(t) {
  var recursiveReference

  var target = thermite.eval('(function rec(x) {\n'
    + '  return x ? rec(x.tail) + 1 : 0\n'
    + '})')

  // Call the function so that recursiveReference gets set
  var recursiveReference = target.result

  // Replace this with a new calculation
  target.hotSwap('(function rec(x) {\n'
    + '  return x ? rec(x.tail) + 1 : 100\n'
    + '})')

  t.equal(recursiveReference({ tail: { tail: {} } }), 103)
  t.end()
})

test('should propagate parse error', function(t) {
  var originalLog = console.log
  var logs = []
  console.log = logs.push.bind(logs)
  try {
    try {
      thermite.eval('1.1.1')
    } finally {
      console.log = originalLog
    }
  } catch(err) {
    t.equal(logs[0], 'Error parsing source:')
    t.equal(logs[1], '1.1.1')
    return t.end()
  }
  t.fail('failed to propagate error')
  t.end()
})

test('should propagate parse error during hotSwap', function(t) {
  var target = thermite.eval('1.1')
  var originalLog = console.log
  var logs = []
  console.log = logs.push.bind(logs)
  try {
    try {
      target.hotSwap('1.1.1')
    } finally {
      console.log = originalLog
    }
  } catch(err) {
    t.equal(logs[0], 'Error parsing source:')
    t.equal(logs[1], '1.1.1')
    return t.end()
  }
  t.fail('failed to propagate error')
  t.end()
})

test('should propagate runtime error', function(t) {
  var originalLog = console.log
  var logs = []
  console.log = logs.push.bind(logs)
  try {
    try {
      thermite.eval('a.b.c')
    } finally {
      console.log = originalLog
    }
  } catch(err) {
    t.equal(logs[0], 'Error evaling code:')
    t.equal(logs[1], 'a.b.c')
    return t.end()
  }
  t.fail('failed to propagate error')
  t.end()
})

test('should handle changing declaration to expression', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  function fn(a, b) {\n'
    + '    return a + b\n'
    + '  }\n'
    + '  return fn\n'
    + '})()')
  var fn = target.result
  target.hotSwap('(function() {\n'
    + '  var fn = function(a, b) {\n'
    + '    return a * b\n'
    + '  }\n'
    + '  return fn\n'
    + '})()')
  t.equal(fn(2, 3), 6)
  t.end()
})

test('should handle changing expression to declaration', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  var fn = function(a, b) {\n'
    + '    return a * b\n'
    + '  }\n'
    + '  return fn\n'
    + '})()')
  var fn = target.result
  target.hotSwap('(function() {\n'
    + '  function fn(a, b) {\n'
    + '    return a + b\n'
    + '  }\n'
    + '  return fn\n'
    + '})()')
  t.equal(fn(2, 3), 5)
  t.end()
})

test('should preserve deleted functions', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  return function() { return "hello" }\n'
    + '})()')
  var fn = target.result
  target.hotSwap('(function() {\n'
    + '  return\n'
    + '})()')
  t.equal(fn(), 'hello')
  t.end()
})

test('should update multiple expressions', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  var a = function() { return "a" }\n'
    + '  var b = function() { return "b" }\n'
    + '  return { a: a, b: b }\n'
    + '})()')
  var fns = target.result
  target.hotSwap('(function() {\n'
    + '  var a = function() { return "a1" }\n'
    + '  var b = function() { return "b1" }\n'
    + '  return { a: a, b: b }\n'
    + '})()')
  t.equal(fns.a(), 'a1')
  t.equal(fns.b(), 'b1')
  t.end()
})

test('should update multiple declarations', function(t) {
  var target = thermite.eval('(function() {\n'
    + '  return { a: a, b: b }\n'
    + '  function a() { return "a" }\n'
    + '  function b() { return "b" }\n'
    + '})()')
  var fns = target.result
  target.hotSwap('(function() {\n'
    + '  return { a: a, b: b }\n'
    + '  function a() { return "a1" }\n'
    + '  function b() { return "b1" }\n'
    + '})()')
  t.equal(fns.a(), 'a1')
  t.equal(fns.b(), 'b1')
  t.end()
})
