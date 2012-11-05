var m = require("./mold.node.js"), tests = [];

simple("escape", "a <?t $arg?> b", "<&", "a &lt;&amp; b");
simple("noescape", "a <?h $arg?> b", "<>", "a <> b");

simple("array",
       "a <?for e $arg?>(<?t e?>)<?/for?> b", [1, 2, 3],
       "a (1)(2)(3) b");
simple("obj",
       "a <?for p, v in $arg?><?t p?>=<?t v?><?/for?> b", {x: 10, y: 20},
       "a x=10y=20 b");
simple("array_$i",
       "a <?for e $arg?>(<?t e?>, <?t $i?>)<?/for?> b", [1, 2, 3],
       "a (1, 0)(2, 1)(3, 2) b");
simple("obj_$i",
       "a <?for p, v in $arg?><?if $i?>, <?/if?><?t p?>=<?t v?><?/for?> b", {x: 10, y: 20},
       "a x=10, y=20 b");

test("if", function() {
  var tmpl = m.bake("a <?if $arg?>foo<?/if?><?if !$arg?>bar<?/if?> b");
  eq(tmpl(true), "a foo b");
  eq(tmpl(false), "a bar b");
});
test("else", function() {
  var tmpl = m.bake("a <?if $arg?>foo<?else?>bar<?/if?> b");
  eq(tmpl(true), "a foo b");
  eq(tmpl(false), "a bar b");
});
test("elif", function() {
  var tmpl = m.bake("a <?if $arg==1?>foo<?elif $arg==2?>bar<?else?>quux<?/if?> b");
  eq(tmpl(1), "a foo b");
  eq(tmpl(2), "a bar b");
  eq(tmpl(3), "a quux b");
});

test("ctx", function() {
  var set, ctx = {a: 100, b: function(x){set = x;}};
  var tmpl = m.bake("<?t a?><?do b(5);?>x", ctx);
  eq(tmpl(), "100x");
  eq(set, 5);
  ctx.a = 200;
  eq(tmpl(), "200x");
});

test("define", function() {
  m.define("paren", function(a) {return "(" + a + ")";});
  m.define("sub", m.bake("[<?t $arg?>]"));
  eq(m.bake("<?paren 10?><?sub 20?>")(), "(10)[20]");
});

// DRIVER CODE

function Failure(why) {this.message = why;}
Failure.prototype.toString = function() { return this.message; };

function test(name, run) {
  tests.push({name: name, run: run});
}
function simple(name, tmpl, arg, out) {
  test(name, function() {eq(m.bake(tmpl)(arg), out);});
}

function label(str, msg) {
  if (msg) return str + " (" + msg + ")";
  return str;
}
function eq(a, b, msg) {
  if (a != b) throw new Failure(label(a + " != " + b, msg));
}
function is(a, msg) {
  if (!a) throw new Failure(label("assertion failed", msg));
}

function runTests() {
  var failures = [], run = 0;
  tests.forEach(function(test) {
    try { test.run(); }
    catch(e) {failures.push({name: test.name, condition: e});}
    ++run;
  });
  console.log("Ran " + run + " tests.");
  if (!failures.length) {
    console.log("All passed!");
  } else {
    console.log(failures.length + " failure" + (failures.length - 1 ? "s:" : ":"));
    failures.forEach(function(fail) {
      console.log(" " + fail.name + (fail.condition instanceof Failure ? " failed: " : " threw: ") +
                  fail.condition.toString());
    });
  }
}

runTests();
