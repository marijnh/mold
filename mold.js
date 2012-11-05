var Mold = {};

// Evaluate something in a relatively clean environment, to prevent
// name clashing.
Mold.cleanEval = function(__string) {
  return window.eval(__string);
};

(function() {
  function splitTemplate(template) {
    var parts = [];
    function addString(string) {
      if (string.length)
        parts.push(string);
    }

    while (true) {
      var open = template.search(/[\[<]\?/);
      if (open == -1) {
        addString(template);
        break;
      }
      else {
        addString(template.slice(0, open));
        var close = template.indexOf("?" + (template.charAt(open) == "<" ? ">" : "]"), open + 2);
        if (close == -1) throw new Error("'<?' without matching '?>' in template.");
        var content = template.slice(open + 2, close), match = content.match(/^([\w\/]+)(?:\s+((?:\r|\n|.)+))?$/);
        if (!match) throw new Error("Template command ('" + content + "') does not follow 'command [arguments]' format.");
        parts.push({command: match[1], args: match[2]});
        template = template.slice(close + 2);
      }
    }

    return parts;
  }

  var snippets, snippet;
  Mold.addSnippet = function addSnippet(f) {
    if (snippets) {
      snippets.push(f);
      return snippets.length - 1;
    }
  };

  var labels;
  Mold.setLabel = function setLabel(name) {
    return function(node) {
      if (!labels) labels = {};

      if (forDepth > 0) {
        var array = labels[name] || (labels[name] = []);
        if (array.push) array.push(node);
      }
      else {
        labels[name] = node;
      }
    };
  };

  Mold.forDepth = 0;
  var casting = false;

  var HTMLspecial = {"<": "&lt;", "&": "&amp;", "\"": "&quot;"};
  Mold.escapeHTML = function escapeHTML(text) {
    return String(text).replace(/[<&\"]/g, function(ch) {return HTMLspecial[ch];});
  };
  var JSspecial = {"\"": "\\\"", "\\": "\\\\", "\f": "\\f", "\b": "\\b",
                   "\n": "\\n", "\t": "\\t", "\r": "\\r", "\v": "\\v"};
  function escapeString(text) {
    return String(text).replace(/[\"\\\f\b\n\t\r\v]/g, function(ch) {return JSspecial[ch];});
  }

  Mold.attachEvent = null;
  Mold._attachEvent = function(node, eventName, func) {
    var wrapped = function(event) {func(event || window.event, node);};
    if (eventName == "enter") {
      var origFunc = func;
      func = function(event, node){if ((event.charCode || event.keyCode) == 13) origFunc(event, node);};
      eventName = "keydown";
    }

    if (Mold.attachEvent)
      Mold.attachEvent(node, eventName, wrapped);
    else if (node.addEventListener)
      node.addEventListener(eventName, wrapped, false);
    else
      node.attachEvent("on" + eventName, wrapped);
  };

  Mold.forEach = function forEach(array, f) {
    for (var i = 0; i < array.length; i++)
      f(array[i], i);
  };
  var hop = Object.prototype.hasOwnProperty;
  Mold.forEachIn = function forEachIn(obj, f) {
    var i = 0;
    for (var n in obj) {
      if (hop.call(obj, n))
        f(n, obj[n], i++);
    }
  };

  var custom = {};
  Mold.define = function(name, func) {
    custom[name] = func;
  };
  Mold.dispatchCustom = function(name, arg, output) {
    if (!custom.hasOwnProperty(name))
      throw new Error("Unrecognised template command: '" + name + "'.");
    output.push(custom[name](arg, output));
  };

  Mold.bake = function bake(template) {
    var parts = splitTemplate(template);
    var func = ["[function templateFunction($arg, __output){\nvar __out = __output || [];\n"];
    var stack = [], match;

    while (parts.length) {
      var cur = parts.shift();
      if (typeof cur == "string") {
        func.push("__out.push(\"" + escapeString(cur) + "\");\n");
        continue;
      }
      switch (cur.command) {

      case "text": case "t":
        func.push("__out.push(Mold.escapeHTML(" + cur.args + "));\n");
        break;
      case "html": case "h":
        func.push("__out.push(" + cur.args + ");\n");
        break;
      case "do": case "d":
        func.push(cur.args + "\n");
        break;

      case "if":
        stack.push("if");
        func.push("if (" + cur.args + ") {\n");
        break;
      case "elif":
        if (stack[stack.length - 1] != "if") throw new Error("'elif' without matching 'if' in template.");
        func.push("} else if (" + cur.args + ") {\n");
        break;
      case "else":
        if (stack[stack.length - 1] != "if") throw new Error("'else' without matching 'if' in template.");
        func.push("} else {\n");
        break;
      case "/if":
        if (stack.pop() != "if") throw new Error("'/if' without matching 'if' in template.");
        func.push("}\n");
        break;

      case "for":
        stack.push("for");
        if (match = cur.args.match(/^([\w\$_]+)(?:,\s*([\w\$_]+))?\s+in\s+((?:\r|\n|.)+)$/))
          func.push("Mold.forDepth++;\nMold.forEachIn(" + match[3] + ", function(" + match[1] + ", " +
                    (match[2] || "$dummy") + ", $i) {\n");
        else if (match = cur.args.match(/^([\w\$_]+)\s+((?:\r|\n|.)+)$/))
          func.push("Mold.forDepth++;\nMold.forEach(" + match[2] + ", function(" + match[1] + ", $i) {\n");
        else
          throw new Error("Malformed arguments to 'for' form in template -- expected variable name followed by expression.");
        break;
      case "/for":
        if (stack.pop() != "for") throw new Error("'/for' without matching 'for' in template.");
        func.push("});\nMold.forDepth--;\n");
        break;

      case "event":
        if (match = cur.args.match(/^(\w+)\s+((?:\r|\n|.)+)$/))
          func.push("__out.push(\"<var class=\\\"__mold \" + Mold.addSnippet(function(__node){Mold._attachEvent(__node, \"" + 
                    match[1] + "\", function($event, $node) {\n" + match[2] + "\n});}) + \"\\\"></var>\");\n");
        else
          throw new Error("Malformed arguments to 'event' form in template -- expected event name followed by handler body.");
        break;
      case "run": case "r":
        func.push("__out.push(\"<var class=\\\"__mold \" + Mold.addSnippet(function($node){" + cur.args + "}) + \"\\\"></var>\");\n");
        break;
      case "label": case "l":
        func.push("__out.push(\"<var class=\\\"__mold \" + Mold.addSnippet(Mold.setLabel(\"" + escapeString(cur.args) +
                  "\")) + \"\\\"></var>\");\n");
        break;
      case "call":
        var f = cur.args, arr = f.indexOf("->"), arg = "null";
        if (arr != -1) {arg = f.slice(arr + 2); f = f.slice(0, arr);}
        func.push(f + "(" + arg + ", __out);");
        break;

      default:
        func.push("Mold.dispatchCustom(\"" + escapeString(cur.command) + "\", " + (/^\s*$/.test(cur.args) ? "null" : cur.args) + ", __out);\n");
      }
    }
    if (stack.length) throw new Error("Unclosed blocks in template (" + stack.join() + ").");

    func.push("return __output ? \"\" : __out.join(\"\");\n}]");
    // The brackets are there to work around some weird IE6 behaviour.
    return Mold.cleanEval(func.join(""))[0];
  };

  Mold.cast = function cast(target, mold, arg) {
    if (casting) throw new Error("Mold.cast must not be called recursively.");

    snippets = [], snippet = 0, labels = null, forDepth = 0, casting = true;
    try {
      target.innerHTML = mold(arg);
      var varTags = target.getElementsByTagName("VAR"), array = [];
      // Copy tags into array -- FF modifies the varTags collection when you delete nodes in it.
      for (var i = 0; i < varTags.length; i++)
        array.push(varTags[i]);
      for (var i = 0; i < array.length; i++) {
        var varTag = array[i], match = varTag.className.match(/^__mold (\d+)$/);
        if (match) {
          var prev = varTag.previousSibling;
          while (prev && prev.nodeType == 3) prev = prev.previousSibling;
          snippets[match[1]](prev || varTag.parentNode);
          varTag.parentNode.removeChild(varTag);
        }
      }

      var result = labels;
    }
    finally {
      labels = snippets = null;
      casting = false;
    }
    return result;
  };

  Mold.castAppend = function castAppend(target, mold, arg) {
    var temp = target.ownerDocument.createElement("DIV");
    var result = Mold.cast(temp, mold, arg);
    while (temp.firstChild)
      target.appendChild(temp.firstChild);
    return result;
  };
})();
