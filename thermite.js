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
  '  (__thermiteFunctionVersion_$thermiteBlockID || -1)) {',
  '',
  '  __thermiteFunction_$thermiteBlockID =',
  '    eval(__thermiteMap.$thermiteContextID.$thermiteBlockID.code)',
  '',
  '  __thermiteFunctionVersion_$thermiteBlockID =',
  '    __thermiteMap.$thermiteContextID.$thermiteBlockID.codeVersion',
  '}',
  '',
  'return __thermiteFunction_$thermiteBlockID.apply(this, arguments)',
  '',
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
    hotSwap: function(source) { return hotSwap(state, source) },
    result: invokeEval(options.eval || eval, rewritten)
  }
}

function hotSwap(state, source) {

  state.version++

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
    console.log('Error parsing source:')
    console.log(source)
    throw err
  }
}

function rewriteNodeAndStoreInMap(contextID, version, node) {

  var code = node.source()
  var blockID = blockIDCounter.getNextID()
  var name = ''

  // Strip out the name (to handle recursive references)
  if(node.id && node.id.name) {
    name = node.id.name
    code = code.replace(name, '')
    node.update(code)
  }

  var addVersionTo = {
    FunctionDeclaration: addVersionToDeclaration,
    FunctionExpression: addVersionToExpression
  }
  var boundTemplate = addVersionTo[node.type](template, name)
    .replace(/\$thermiteTemplate/g, name)
    .replace(/\$thermiteBlockID/g, blockID)
    .replace(/\$thermiteContextID/g, contextID)

  node.update(boundTemplate)

  var entries = getEntriesForContext(contextID)
  entries[blockID] = {
    blockID: blockID,
    node: node,
    codeVersion: version,
    code: '(' + code + ')'
  }
}

function addVersionToDeclaration(template, name) {
  return '; '
    + 'var __thermiteFunctionVersion_$thermiteBlockID; '
    + 'var __thermiteFunction_$thermiteBlockID; '
    + template
}

function addVersionToExpression(template, name) {
  return '(function ' + name + '() { '
    + 'var __thermiteFunctionVersion_$thermiteBlockID; '
    + 'var __thermiteFunction_$thermiteBlockID; '
    + 'return (' + template + ');'
  + '})()'
}

function rangeToString(range) {
  return 'from' + range[0] + 'to' + range[1]
}

exports.eval = thermiteEval

