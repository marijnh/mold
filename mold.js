(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    module.exports = mod();
  else if (typeof define == "function" && define.amd) // AMD
    return define([], mod);
  else // Plain browser env
    (this || window).Mold = mod();
})(function() {
"use strict";

function Mold(env) {
  this.env = env || {}
  this.defs = Object.create(null)
}

Mold.prototype.bake = function(name, string) {
  if (string == null) { string = name; name = null }
  if (typeof string !== "string")
    throw new TypeError("Mold template must be a string")

  var template = new Template(string, name)
  var result = evaluate(compile(template), this)
  if (name) this.defs[name] = result
  return result
}

var HTMLspecial = {"<": "&lt;", "&": "&amp;", "\"": "&quot;"}
Mold.prototype.escapeHTML = function(text) {
  return String(text).replace(/[<&\"]/g, function(ch) {return HTMLspecial[ch]})
}

var hop = Object.prototype.hasOwnProperty
Mold.prototype.forEachIn = function(obj, f) {
  var i = 0
  for (var n in obj) if (hop.call(obj, n)) f(n, obj[n], i++)
}

Mold.prototype.dispatch = function(name) {
  if (!(name in this.defs))
    throw new Error("Unrecognised template command: '" + name + "'.")
  var args = Array.prototype.slice.call(arguments, 1)
  return this.defs[name].apply(this.defs, args)
}



function Template(string, name) {
  this.string = string
  this.name = name
}

Template.prototype.error = function(message, pos) {
  var line = 1
  for (var at = 0;;) {
    var nl = this.string.indexOf("\n", at)
    if (nl == -1 || nl > pos) break
    line++
    at = nl + 1
  }
  throw new SyntaxError(message + (this.name ? " at " + this.name + ":" + line : " at line " + line))
}

function tokenize(template) {
  var string = template.string, parts = [], pos = 0

  function addString(string) {
    var before = /^\n\s*/.exec(string)
    if (before) string = string.slice(before[0].length)
    var after = /\n\s*$/.exec(string)
    if (after) string = string.slice(0, after.index)
    if (string.length) parts.push(string)
  }

  for (;;) {
    var open = string.indexOf("<<", pos)
    if (open == -1) {
      addString(string.slice(pos))
      return parts
    } else {
      while (string[open + 2] == "<") open++
      addString(string.slice(pos, open))
      var close = string.indexOf(">>", open + 2)
      if (close == -1) template.error("Unclosed template tag", open)
      var tag = /^([\w\/]+)(?:\s+((?:\r|\n|.)+))?$/.exec(string.slice(open + 2, close))
      if (!tag) template.error("Invalid template tag", open + 2)
      parts.push({command: tag[1], args: tag[2], pos: open + 2})
      pos = close + 2
    }
  }
}

function compile(template) {
  var tokens = tokenize(template)
  var code = "function($in) {\nvar __O = ''\n"
  var stack = [{type: "top", pos: 0}], match

  for (var i = 0; i < tokens.length; i++) {
    var tok = tokens[i]
    if (typeof tok == "string") {
      code += "__O += " + JSON.stringify(tok) + "\n"
      continue
    }

    switch (tok.command) {
    case "in":
      var parsed = parseInput(tok.args, "$in")
      if (parsed == null) template.error("Invalid input pattern", tok.pos)
      code += parsed
      break

    case "text": case "t":
      code += "__O += __M.escapeHTML(" + tok.args + ")\n"
      break

    case "html": case "h":
      code += "__O += (" + tok.args + ")\n"
      break

    case "do": case "d":
      code += tok.args + ";\n"
      break

    case "if":
      stack.push({type: "if", pos: tok.pos})
      code += "if (" + tok.args + ") {\n"
      break

    case "elif":
      if (stack[stack.length - 1].type != "if") template.error("'elif' without matching 'if'", tok.pos)
      code += "} else if (" + tok.args + ") {\n"
      break

    case "else":
      if (stack[stack.length - 1].type != "if") template.error("'else' without matching 'if'", tok.pos)
      code += "} else {\n"
      break

    case "/if":
      if (stack.pop().type != "if") template.error("'/if' without matching 'if'", tok.pos)
      code += "}\n"
      break

    case "for":
      stack.push({type: "for", pos: tok.pos})
      if (match = tok.args.match(/^([\w\$_]+)(?:,\s*([\w\$_]+))?\s+in\s+((?:\r|\n|.)+)$/)) {
        code += "__M.forEachIn(" + match[3] + ", function(" + match[1] + ", " +
          (match[2] || "$dummy") + ", $i) {\n"
      } else if (match = tok.args.match(/^([\w\$_]+)\s+((?:\r|\n|.)+)$/)) {
        code += ";(" + match[2] + ").forEach(function(" + match[1] + ", $i) {\n"
      } else {
        template.error("Malformed arguments to 'for' form -- expected variable name followed by expression", tok.pos)
      }
      break

    case "/for":
      if (stack.pop().type != "for") template.error("'/for' without matching 'for'", tok.pos)
      code += "})\n"
      break

    default:
      code += "__O += __M.dispatch(" + JSON.stringify(tok.command) + ", " + (/^\s*$/.test(tok.args) ? "null" : tok.args) + ")\n"
    }
  }

  if (stack.length > 1) {
    var bad = stack.pop()
    template.error("Unclosed " + bad.type + " block in template", bad.pos)
  }

  code += "return __O\n}"
  return code
}

function parseInput(pattern, input) {
  var obj = /^\s*\{\s*([\w$]+(?:\s*,\s*[\w$]+)*)\s*\}\s*$/.exec(pattern)
  if (obj) {
    var vars = obj[1].split(/\s*,\s*/), out = "var "
    for (var i = 0; i < vars.length; i++)
      out += (i ? ", " : "") + vars[i] + " = " + input + "." + vars[i]
    return out + "\n"
  } else {
    return "var " + pattern + " = " + input + "\n"
  }
}

function evaluate(code, mold) {
  var ctx = {__mold: mold}
  var prelude = "var __M = __CTX.__mold;\n"
  for (var prop in mold.env) if (mold.env.hasOwnProperty(prop)) {
    prelude += "var " + prop + " = __CTX." + prop + "\n"
    ctx[prop] = mold.env[prop]
  }
  return new Function("__CTX", prelude + "return " + code)(ctx)
}

return Mold
})
