// Standardize a few unportable event properties.
function normalizeEvent(event) {
  if (!event.stopPropagation) {
    event.stopPropagation = function() {this.cancelBubble = true;};
    event.preventDefault = function() {this.returnValue = false;};
  }
  if (!event.stop) {
    event.stop = function() {
      this.stopPropagation();
      this.preventDefault();
    };
  }

  if (event.type == "keypress") {
    if (event.charCode === 0 || event.charCode == undefined)
      event.code = event.keyCode;
    else
      event.code = event.charCode;
    event.character = String.fromCharCode(event.code);
  }
  return event;
}

// Portably register event handlers.
function addEventHandler(node, type, handler) {
  function wrapHandler(event) {
    handler(normalizeEvent(event || window.event));
  }
  if (typeof node.addEventListener == "function") {
    node.addEventListener(type, wrapHandler, false);
    return function() { node.removeEventListener(type, wrapHandler, false); };
  }
  else {
    node.attachEvent("on" + type, wrapHandler);
    return function() { node.detachEvent("on" + type, wrapHandler); };
  }
}

function removeEventHandler(handler) {
  handler();
}

function forEach(array, f) {
  for (var i = 0; i < array.length; i++)
    f(array[i]);
}

function removeNode(node) {
  node.parentNode.removeChild(node);
}

(function(){
  var HTMLspecial = {"<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;"};
  var JSspecial = {"\"": "\\\"", "\\": "\\\\", "\f": "\\f", "\b": "\\b",
                   "\n": "\\n", "\t": "\\t", "\r": "\\r", "\v": "\\v"};
  window.escapeHTML = function escapeHTML(text) {
    return String(text).replace(/[<>&\"]/g, function(ch) {return HTMLspecial[ch];});
  }
  window.escapeString = function escapeString(text) {
    return String(text).replace(/[\"\\\f\b\n\t\r\v]/g, function(ch) {return JSspecial[ch];});
  }
})();
