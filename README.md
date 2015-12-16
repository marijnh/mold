# Mold templating library

Mold is a minimalist templating library that compiles strings
containing templating directives to functions that instantiate the
template.

Mold's directives are surrounded by `<<` and `>>`.
The simplest commands are `<<t EXPR>>` (also `<<text >>`), which
inserts the result of the given JavaScript expression and HTML-escapes
it in the process, and `<<h EXPR>>` (also `<<html >>`) which inserts
the given expression as-is, without escaping.

    <p>Hello <<t $in.user>>, your score is <<t $in.score>>.</p>

Simple control flow can be performed as follows:

    <ul>
      <<for x arrayEXPR>>
        <li><<if typeof x == "string">>
          <<t x>>
        <<elif x == null>>
          (missing)
        <<else>>
          <<t x.render()>>
        <</if>></li>
      <</for>>
    </ul>

Inside `for` constructs, `$i` is bound to the index of the current
item. A similar construct, `<<for key, value in objEXPR>>` can be used
to iterate over object properties.

## API

Mold templates are _baked_ (precompiled) before they are instantiated.
To bake a template, you need a `Mold` object.

    var Mold = require("mold-template")
    var mold = new Mold({myGlobal: "hi"})

A `Mold` object takes an optional scope object, whose properties are
visible as variables to the code in all templates baked by that
object.

It has a `bake` property:

    var template = mold.bake("mytemplate", "hi <<t $in.name>>")
    console.log(template({name: "Sue"}))
    // → "hi Sue"

A baked template is a function from an input value to a string. The
input value provides the `$in` variable inside the template. You can
also unpack with an `in` directive:

    <<in {name, score}>>
    <p>Hello <<t name>>, your score is <<t score>>.</p>

`in` only understands plain object literals (with only property names
in them) and variable names (`<<in item>>`), except when your JS
engine supports ES6 destructuring, in which case you can use all the
patterns, nesting, and defaulting that the language supports.

You can define your own directives with the `defs` property of a
`Mold` object. All templates baked with `bake`, when a name was
specified for them, are automatically available under their name. You
can also add your own functions that return strings.

    mold.defs.caps = function(val) { return String(val).toUpperCase() }
    console.log(mold.bake("say <<caps $in>>?")("what"))
    // → "say WHAT?"

## Community

This software is released under an MIT license. You are invited to
report bugs or submit patches via
[GitHub](http://github.com/marijnh/mold/).
