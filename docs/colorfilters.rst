Color Filters
=============

When specifying colors for cSplit or elsewhere, you can use filters to transform the colors.
To use a filter, type ``;<filter>[value]`` after the color.
Value is an optional value from 0 to 100 that defaults to 10.
The filters available are:

* ``lighten``
* ``brighten``
* ``darken``
* ``desaturate``
* ``saturate``
* ``spin`` (Value is required and ranges from -360 to 360.)
* ``grayscale`` (Doesn't accept a value. ``greyscale`` also works.)

.. rubric:: Examples

* ``goldenrod;lighten``
* ``goldenrod;lighten20``
* ``/cspl conf Username=goldenrod;lighten``
* ``/cspl conf Username=goldenrod;lighten20``
