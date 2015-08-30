'use strict'

var falafel = require('falafel')
var DiffMatchPatch = require('googlediff')
var survivor = require('survivor')
var functionNodeTypes = ['FunctionExpression', 'FunctionDeclaration']
var blockIDCounter = new Counter('f')
var contextIDCounter = new Counter('c')

var template = ['function $thermiteTemplate() {',
  '',
  'if(__thermiteMap.$thermiteContextID.$thermiteBlockID.codeVersion >',
  '  (__thermiteFunctionVersion || -1)) {',
  '',
  '  __thermiteMap.$thermiteContextID.$thermiteBlockID.fn =',
  '    eval(__thermiteMap.$thermiteContextID.$thermiteBlockID.code)',
  '',
  '  __thermiteFunctionVersion =',
  '    __thermiteMap.$thermiteContextID.$thermiteBlockID.codeVersion',
  '}',
  '',
  'return __thermiteMap.$thermiteContextID.$thermiteBlockID.fn',
  '  .apply(this, arguments)',
'}'].join('\n')

global.__thermiteMap = {}

function Counter(label) {
  this.label = label
  this.value = 0
}

Counter.prototype.getNextID = function() {
  return this.label + (this.value++)
}

function thermiteEval(source, options) {

  options = options || {}
  var fnTree = {}
  var state = {
    contextID: contextIDCounter.getNextID(),
    lastSource: source,
    doLineDiff: options.lineDiff || false,
    version: 1
  }

  var rewritten = forEachNode(source, function(node) {
    if(functionNodeTypes.indexOf(node.type) < 0) return
    rewriteNodeAndStoreInMap(state.contextID, state.version, node)
  }).toString()

  return {
    update: function(source) { return update(state, source) },
    result: invokeEval(options.eval || eval, rewritten)
  }
}

function update(state, source) {

  state.version++

  var updateID = 0
  var dmp = new DiffMatchPatch()
  var diffs = dmp.diff_main(state.lastSource, source, state.doLineDiff)
  var lookup = survivor(diffs, true)
  var entries = getEntriesForContext(state.contextID)
  var entriesByRangeString = {}
  var persistedBlockIDs = {}

  for(var blockID in entries) {
    var entry = entries[blockID]
    if(entry.deleted) continue
    var rangeString = rangeToString(entry.node.range)
    entriesByRangeString[rangeString] = entry
  }

  forEachNode(source, function(node) {
    if(functionNodeTypes.indexOf(node.type) < 0) return
    var startSurvived = lookup(node.range[0])
    var endSurvived = lookup(node.range[1])
    var existingEntry = startSurvived
      && endSurvived
      && entriesByRangeString[rangeToString([startSurvived, endSurvived])]
    if(!existingEntry)
      return rewriteNodeAndStoreInMap(state.contextID, state.version, node)
    // Mutate the entry to contain the new info:
    existingEntry.codeVersion = state.version
    existingEntry.code = '(' + node.source() + ')'
    existingEntry.node = node
    persistedBlockIDs[existingEntry.blockID] = true
  })

  for(var blockID in entries)
    if(!(blockID in persistedBlockIDs))
      entries[blockID].deleted = true

  state.lastSource = source
}

function getEntriesForContext(contextID) {
  return __thermiteMap[contextID] = __thermiteMap[contextID] || {}
}

function invokeEval(evaler, code) {
  try {
    return evaler(code)
  } catch(err) {
    console.log('Error evaling code:')
    console.log(code)
    throw err
  }
}

function forEachNode(source, visitor) {
  try {
    return falafel(source, { ranges: true }, visitor)
  } catch(err) {
    console.log('Error rewriting source:')
    console.log(source)
    throw err
  }
}

function rewriteNodeAndStoreInMap(contextID, version, node) {

  var code = node.source()
  var blockID = blockIDCounter.getNextID()
  var name = ''
  var boundTemplate = template
    .replace(/\$thermiteBlockID/g, blockID)
    .replace(/\$thermiteContextID/g, contextID)

  // Strip out the name (to handle recursive references)
  if(node.id && node.id.name) {
    name = node.id.name
    code = code.replace(name, '')
    node.update(code)
  }

  switch(node.type) {
  case 'FunctionDeclaration':
    boundTemplate = addVersionToDeclaration(boundTemplate, name)
    break
  case 'FunctionExpression':
    boundTemplate = addVersionToExpression(boundTemplate, name)
    break
  default:
    throw new Error('unexpected: ' + node.type)
  }

  node.update(boundTemplate)

  var entries = getEntriesForContext(contextID)
  entries[blockID] = {
    blockID: blockID,
    node: node,
    codeVersion: version,
    code: '(' + code + ')'
  }
}

function addVersionToDeclaration(boundTemplate, name) {
  return 'var __thermiteFunctionVersion;'
    + boundTemplate.replace('$thermiteTemplate', name)
}

function addVersionToExpression(boundTemplate, name) {
  return '(function ' + name + '() { '
    + 'var __thermiteFunctionVersion; '
    + 'return (' + boundTemplate.replace('$thermiteTemplate', '') + ')'
    + '.apply(this, arguments)'
  + '})'
}

function rangeToString(range) {
  return 'from' + range[0] + 'to' + range[1]
}

exports.eval = thermiteEval

