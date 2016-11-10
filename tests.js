#!/usr/bin/env node

'use strict'

var assert = require('assert')
var thermite = require('./thermite.js')

/////////////////////
// Test basic eval //
/////////////////////

it('should should eval raw JavaScript', function() {
  assert.equal(thermite.eval('123').result, 123)
})

it('should eval an anonymous function', function() {
  var fn = thermite.eval('(function() { return 123 })').result
  assert.equal(fn(), 123)
})

it('should eval a named function', function() {
  var fn = thermite.eval('(function x() { return 123 })').result
  assert.equal(fn(), 123)
  assert.equal(fn.name, 'x')
})

it('should eval in scope', function() {
  var x = 123
  thermite.eval('x = 5', {
    eval: function(code) { return eval(code) }
  })
  assert.equal(x, 5)
})

/////////////////////////////
// Test basic hot swapping //
/////////////////////////////

it('should replace functions', function() {
  var target = thermite.eval('(function noop() {})')
  target.hotSwap('(function add(x, y) { return x + y })')
  assert.equal(target.result(2, 3), 5)
})

it('should replace multiline functions', function() {
  var target = thermite.eval('(function noop() {})')
  target.hotSwap('(function add(x, y) { return x + y })')
  assert.equal(target.result(2, 3), 5)
})

it('should hotSwap function references', function() {
  var target = thermite.eval('(function() {})')
  var savedReference = target.result
  target.hotSwap('(function add(x, y) { return x + y })')
  assert.equal(savedReference(2, 3), 5)
})

it('should hotSwap recursive-style function references', function() {
  var target = thermite.eval('(function length(x) {\n'
    + '  return x ? rec(x.tail) + 1 : 0\n'
    + '})')
  var savedReference = target.result
  target.hotSwap('(function length(x) {\n'
    + '  return x ? length(x.tail) + 1 : 100\n'
    + '})')
  assert.equal(savedReference({ tail: { tail: {} } }), 103)
})

it('should hot swap nested functions', function() {
  var target = thermite.eval('(function outer() {\n'
    + '  return "outer-" + inner()\n'
    + '  function inner() { return "inner" }\n'
    + '})')
  var savedReference = target.result
  target.hotSwap('(function outer() {\n'
    + '  return "outerChanged-" + inner()\n'
    + '  function inner() { return "innerChanged" }\n'
    + '})')
  assert.equal(savedReference(), 'outerChanged-innerChanged')
})

it('should hot swap nested function twice', function() {
  var target = thermite.eval('(' + function outer() {
    return function inner() {}
  } + ')')

  target.hotSwap('(' + function outer() {
    return function inner() { return 'a' }
  } + ')')
  var callback = target.result()

  target.hotSwap('(' + function outer() {
    return function inner() { return 'b' }
  } + ')')

  assert.equal(callback(), 'b')
})

it('should hot swap callbacks twice', function() {
  var state = {}
  var callback = null
  function setCallback(f) { callback = f }

  var target = thermite.eval('(' + function outer(state) {
    return 0
  } + ')')

  target.hotSwap('(' + function outer(state, setCallback) {
    setCallback(function inner() {
      state.value = 1
    })
  } + ')')
  target.result(state, setCallback)
  callback()

  target.hotSwap('(' + function outer(state, setCallback) {
    setCallback(function inner() {
      state.value = 2
    })
  } + ')')
  callback()

  assert.equal(state.value, 2)
})

it('should add functions', function() {
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
  assert.equal(inner2Result, 'inner2Result')
})

it('should hotSwap added functions', function() {
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
  assert.equal(inner2Result, 'inner2ResultChanged')
})

it('should hotSwap added functions 10 times', function() {
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
  assert.equal(inner2Result, 9)
})

it('should hotSwap function twice', function() {
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
  assert.equal(inner(), 2)
})

it('should hotSwap 10 times', function() {
  var target = thermite.eval('(function outer() {\n'
    + '  return function inner() {}\n'
    + '})')
  var outer = target.result
  for(var i = 0; i < 10; i++)
    target.hotSwap('(function outer() {\n'
      + '  return function inner() { return ' + i + ' }\n'
      + '})')
  var inner = outer()
  assert.equal(inner(), 9) // The last value of `i` is 9.
})

it('should hotSwap member functions', function() {
  var target = thermite.eval('(function() {\n'
    + '  return { fn: function() {} }\n'
    + '})')
  var fn = target.result().fn
  target.hotSwap('(function() {\n'
    + '  return { fn: function() { return "hotSwapped" } }\n'
    + '})')
  assert.equal(fn(), 'hotSwapped')
})

it('should hotSwap all copies of a function', function() {
  var target = thermite.eval('(function() {\n'
    + '  return function() {}\n'
    + '})')
  var fn1 = target.result()
  var fn2 = target.result()
  target.hotSwap('(function() {\n'
    + '  return function() { return "hotSwapped" }\n'
    + '})')
  assert.equal(fn1(), 'hotSwapped')
  assert.equal(fn2(), 'hotSwapped')
})

it('should hotSwap recursive function references', function() {
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

  assert.equal(recursiveReference({ tail: { tail: {} } }), 103)
})

it('should propagate parse error', function() {
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
    assert.equal(logs[0], 'Error parsing source:')
    assert.equal(logs[1], '1.1.1')
    return
  }
  assert.fail('failed to propagate error')
})

it('should propagate parse error during hotSwap', function() {
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
    assert.equal(logs[0], 'Error parsing source:')
    assert.equal(logs[1], '1.1.1')
    return
  }
  assert.fail('failed to propagate error')
})

it('should propagate runtime error', function() {
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
    assert.equal(logs[0], 'Error evaling code:')
    assert.equal(logs[1], 'a.b.c')
    return
  }
  assert.fail('failed to propagate error')
})

it('should handle changing declaration to expression', function() {
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
  assert.equal(fn(2, 3), 6)
})

it('should handle changing expression to declaration', function() {
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
  assert.equal(fn(2, 3), 5)
})

it('should preserve deleted functions', function() {
  var target = thermite.eval('(function() {\n'
    + '  return function() { return "hello" }\n'
    + '})()')
  var fn = target.result
  target.hotSwap('(function() {\n'
    + '  return\n'
    + '})()')
  assert.equal(fn(), 'hello')
})

it('should update multiple expressions', function() {
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
  assert.equal(fns.a(), 'a1')
  assert.equal(fns.b(), 'b1')
})

it('should update multiple declarations', function() {
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
  assert.equal(fns.a(), 'a1')
  assert.equal(fns.b(), 'b1')
})

it('should cache function expressions', function() {
  var target = thermite.eval('(function() { return 1 })')
  shouldCache(assert, target, null, 1)
})

it('should cache function declarations', function() {
  var target = thermite.eval('(function() {\n'
    + '  return x\n'
    + '  function x() { return 1 }\n'
    + '})()')
  shouldCache(assert, target, null, 1)
})

it('should cache recursive function expressions', function() {
  var target = thermite.eval('(function factorial(n) {\n'
    + '  return n <= 1 ? 1 : factorial(n - 1) * n\n'
    + '})')
  shouldCache(assert, target, 3, 6)
})

it('should cache recursive function declarations', function() {
  var target = thermite.eval('(function() {\n'
    + '  return factorial\n'
    + '  function factorial(n) {\n'
    + '    return n <= 1 ? 1 : factorial(n - 1) * n\n'
    + '  }\n'
    + '})()')
  shouldCache(assert, target, 3, 6)
})

it('should not swap deleted functions', function() {
  var target = thermite.eval('(function() {\n'
    + '  return function() { return 1 }\n'
    + '})')
  var fn1 = target.result()
  target.hotSwap('(function() {\n'
    + '  return\n'
    + '})')
  target.hotSwap('(function() {\n'
    + '  return function() { return 2 }\n'
    + '})')
  var fn2 = target.result()
  assert.equal(fn1(), 1)
  assert.equal(fn2(), 2)
})

function shouldCache(assert, target, arg, expected) {
  assert.equal(target.result(arg), expected)
  var originalEval = global.eval
  try {
    global.eval = assert.fail
    assert.equal(target.result(arg), expected)
  } finally {
    global.eval = originalEval
  }
}
