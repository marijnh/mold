# Mold templating library

Mold is a minimalist templating library that compiles strings
containing templating directives to functions that instantiate the
template.

Mold's directives are surrounded by `<?` and `?>` (or `[?` and `?]`).
The simplest commands are `<?t EXPR?>` (also `<?text ?>`), which
inserts the result of the given JavaScript expression and HTML-escapes
it in the process, and `<?h EXPR?>` (also `<?html ?>`) which inserts
the given expression as-is, without escaping.

    Mold.bake("Score: <?t $arg?>")(10) == "Score: 10"

Simple control flow can be performed as follows:

    <ul>
      <?for x arrayEXPR?>
        <li><?if typeof x == "string"?>
          <?t x?>
        <?elif x == null?>
          (missing)
        <?else?>
          <?t x.toString()?>
        <?/if?></li>
      <?/for?>
    </ul>

Inside `for` constructs, `$i` is bound to the index of the current
item. A similar construct, `<?for key, value in objEXPR?>` can be used
to iterate over object properties.

`Mold.define(name, func)` allows client code to define additional
directives by associating directive names with functions that map a
directive argument to a string.

The browser version of Mold supports an additional `Mold.cast` method
to insert a template into a DOM node and run code defined by `<?event
...?>` and `<?run ...?>` directives on the resulting nodes. See the
[project page](http://marijnhaverbeke.nl/mold/) for details.

In the node.js version, a second argument can be passed to `Mold.bake`
to provide a context—a set of variables that are available to the
template, even when not passed as `$arg`. If given, it should be an
object, whose properties represent the additional variables.
