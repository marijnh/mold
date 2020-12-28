var mold = require("./mold"), m = new mold, tests = []

simple("escape", "a <<t $in>> b", "<&", "a &lt;&amp; b");
simple("noescape", "a <<h $in>> b", "<>", "a <> b");

simple("array",
       "a <<for e $in>>(<<t e>>)<</for>> b", [1, 2, 3],
       "a (1)(2)(3) b");
simple("obj",
       "a <<for p, v in $in>><<t p>>=<<t v>><</for>> b", {x: 10, y: 20},
       "a x=10y=20 b");
simple("array_$i",
       "a <<for e $in>>(<<t e>>, <<t $i>>)<</for>> b", [1, 2, 3],
       "a (1, 0)(2, 1)(3, 2) b");
simple("obj_$i",
       "a <<for p, v in $in>><<if $i>>, <</if>><<t p>>=<<t v>><</for>> b", {x: 10, y: 20},
       "a x=10, y=20 b");
simple("triple-lt",
       "<<<t \"hi\">>>", null,
       "<hi>")

test("if", function() {
  var tmpl = m.bake("a <<if $in>>foo<</if>><<if !$in>>bar<</if>> b");
  eq(tmpl(true), "a foo b");
  eq(tmpl(false), "a bar b");
});
test("else", function() {
  var tmpl = m.bake("a <<if $in>>foo<<else>>bar<</if>> b");
  eq(tmpl(true), "a foo b");
  eq(tmpl(false), "a bar b");
});
test("elif", function() {
  var tmpl = m.bake("a <<if $in==1>>foo<<elif $in==2>>bar<<else>>quux<</if>> b");
  eq(tmpl(1), "a foo b");
  eq(tmpl(2), "a bar b");
  eq(tmpl(3), "a quux b");
});

test("ctx", function() {
  var m = new mold({a: 100, b: function(x){set = x;}})
  var set
  var tmpl = m.bake("<<t a>><<do b(5);>>x");
  eq(tmpl(), "100x");
  eq(set, 5);
});

test("define", function() {
  m.defs.paren = function(a) {return "(" + a + ")"}
  m.defs.sum = function(a, b) {return a + b}
  m.bake("sub", "[<<t $in>>]")
  eq(m.bake("<<paren 10>><<sub 20>> <<sum 1, 2>>")(), "(10)[20] 3");
});

test("validate", function() {
  try {
    m.bake(Buffer.from("Some content"))
    throw new Error("Should not run")
  } catch (err) {
    eq(err.message, "Mold template must be a string")
  }
})

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
                  (fail.condition.stack || fail.condition.message));
    });
  }
}

runTests();
