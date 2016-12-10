Extended cSplit
===============

Plaza+ makes cSplit configurations easier to create!
You can still use regular cSplit configurations with no problems,
but Plaza+ adds some extra options to cSplit's format.

-----

When specifying a color, you can specify multiple colors to create an RBG gradient.
Each color is separated by a slash (``/``).

	Example: ``/cspl conf Username=red/blue/green``

If you prefer HSV gradients, you can use that too by adding `hsv:` before the colors.  

	Example: ``/cspl conf Username=hsv:gray/blue``

If you didn't know, a rainbow gradient is actually the same as a HSV gradient from red to violet.
There's no need to remember that because you can also use `rainbow` instead of a color list:  

	Example: ``/cspl conf Username=rainbow``
	Same as: ``/cspl conf Username=hsv:red/violet``

-----

Plaza+ also adds in a cSplit stealer: ``/cspl steal <user> [your username]``

.. tip:: If you have an alias with the tag "Me", you don't have to provide your username.

-----

While creating a cSplit, the gradients are expanded once you start a new segment or when you press ``\``.
You can use this to make further adjustments to the cSplit.
If you want to get more advanced, there's also more you can do with colors.

.. seealso::

	:doc:`colorfilters`
		Modify colors on the fly.

	:doc:`colordefs`
		Different ways to specify colors.
