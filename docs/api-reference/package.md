# quilt3.Package

In-memory representation of a package

## manifest

Provides a generator of the dicts that make up the serialized package.

## top\_hash

Returns the top hash of the package.

Note that physical keys are not hashed because the package has the same semantics regardless of where the bytes come from.

**Returns**

A string that represents the top hash of the package

## Package.\_\_repr\_\_\(self, max\_lines=20\) <a id="Package.\_\_repr\_\_"></a>

String representation of the Package.

## Package.install\(name, registry=None, top\_hash=None, dest=None, dest\_registry=None\) <a id="Package.install"></a>

Installs a named package to the local registry and downloads its files.

**Arguments**

* **name\(str\)**:  Name of package to install.
* **registry\(str\)**:  Registry where package is located.

    Defaults to the default remote registry.

* **top\_hash\(str\)**:  Hash of package to install. Defaults to latest.
* **dest\(str\)**:  Local path to download files to.
* **dest\_registry\(str\)**:  Registry to install package to. Defaults to local registry.

**Returns**

A new Package that points to files on your local machine.

## Package.browse\(name=None, registry=None, top\_hash=None\) <a id="Package.browse"></a>

Load a package into memory from a registry without making a local copy of the manifest. **Arguments**

* **name\(string\)**:  name of package to load
* **registry\(string\)**:  location of registry to load package from
* **top\_hash\(string\)**:  top hash of package version to load

## Package.\_\_contains\_\_\(self, logical\_key\) <a id="Package.\_\_contains\_\_"></a>

Checks whether the package contains a specified logical\_key.

**Returns**

True or False

## Package.\_\_getitem\_\_\(self, logical\_key\) <a id="Package.\_\_getitem\_\_"></a>

Filters the package based on prefix, and returns either a new Package or a PackageEntry.

**Arguments**

* **prefix\(str\)**:  prefix to filter on

**Returns**

PackageEntry if prefix matches a logical\_key exactly otherwise Package

## Package.fetch\(self, dest='./'\) <a id="Package.fetch"></a>

Copy all descendants to `dest`. Descendants are written under their logical names _relative_ to self.

**Arguments**

* **dest**:  where to put the files \(locally\)

**Returns**

None

## Package.keys\(self\) <a id="Package.keys"></a>

Returns logical keys in the package.

## Package.walk\(self\) <a id="Package.walk"></a>

Generator that traverses all entries in the package tree and returns tuples of \(key, entry\), with keys in alphabetical order.

## Package.load\(readable\_file\) <a id="Package.load"></a>

Loads a package from a readable file-like object.

**Arguments**

* **readable\_file**:  readable file-like object to deserialize package from

**Returns**

A new Package object

**Raises**

file not found json decode error invalid package exception

## Package.set\_dir\(self, lkey, path=None, meta=None\) <a id="Package.set\_dir"></a>

Adds all files from `path` to the package.

Recursively enumerates every file in `path`, and adds them to the package according to their relative location to `path`.

**Arguments**

* **lkey\(string\)**:  prefix to add to every logical key,

    use '/' for the root of the package.

* **path\(string\)**:  path to scan for files to add to package.

    If None, lkey will be substituted in as the path.

* **meta\(dict\)**:  user level metadata dict to attach to lkey directory entry.

**Returns**

self

**Raises**

When `path` doesn't exist

## Package.get\(self, logical\_key\) <a id="Package.get"></a>

Gets object from logical\_key and returns its physical path. Equivalent to self\[logical\_key\].get\(\).

**Arguments**

* **logical\_key\(string\)**:  logical key of the object to get

**Returns**

Physical path as a string.

**Raises**

* `KeyError`:  when logical\_key is not present in the package
* `ValueError`:  if the logical\_key points to a Package rather than PackageEntry.

## Package.set\_meta\(self, meta\) <a id="Package.set\_meta"></a>

Sets user metadata on this Package.

## Package.build\(self, name=None, registry=None, message=None\) <a id="Package.build"></a>

Serializes this package to a registry.

**Arguments**

* **name**:  optional name for package
* **registry**:  registry to build to

  ```text
    defaults to local registry
  ```

* **message**:  the commit message of the package

**Returns**

The top hash as a string.

## Package.dump\(self, writable\_file\) <a id="Package.dump"></a>

Serializes this package to a writable file-like object.

**Arguments**

* **writable\_file**:  file-like object to write serialized package.

**Returns**

None

**Raises**

fail to create file fail to finish write

## Package.set\(self, logical\_key, entry=None, meta=None, serialization\_location=None, serialization\_format\_opts=None\) <a id="Package.set"></a>

Returns self with the object at logical\_key set to entry.

**Arguments**

* **logical\_key\(string\)**:  logical key to update
* **entry\(PackageEntry OR string OR object\)**:  new entry to place at logical\_key in the package.

    If entry is a string, it is treated as a URL, and an entry is created based on it.

    If entry is None, the logical key string will be substituted as the entry value.

    If entry is an object and quilt knows how to serialize it, it will immediately be serialized and written

    to disk, either to serialization\_location or to a location managed by quilt. List of types that Quilt

    can serialize is available by calling `quilt3.formats.FormatRegistry.all_supported_formats()`

* **meta\(dict\)**:  user level metadata dict to attach to entry
* **serialization\_format\_opts\(dict\)**:  Optional. If passed in, only used if entry is an object. Options to help

    Quilt understand how the object should be serialized. Useful for underspecified file formats like csv

    when content contains confusing characters. Will be passed as kwargs to the FormatHandler.serialize\(\)

    function. See docstrings for individual FormatHandlers for full list of options -

* **https**: //github.com/quiltdata/quilt/blob/master/api/python/quilt3/formats.py
* **serialization\_location\(string\)**:  Optional. If passed in, only used if entry is an object. Where the

    serialized object should be written, e.g. "./mydataframe.parquet"

**Returns**

self

## Package.delete\(self, logical\_key\) <a id="Package.delete"></a>

Returns the package with logical\_key removed.

**Returns**

self

**Raises**

* `KeyError`:  when logical\_key is not present to be deleted

## Package.push\(self, name, registry=None, dest=None, message=None\) <a id="Package.push"></a>

Copies objects to path, then creates a new package that points to those objects. Copies each object in this package to path according to logical key structure, then adds to the registry a serialized version of this package with physical keys that point to the new copies.

**Arguments**

* **name**:  name for package in registry
* **dest**:  where to copy the objects in the package
* **registry**:  registry where to create the new package
* **message**:  the commit message for the new package

**Returns**

A new package that points to the copied objects.

## Package.rollback\(name, registry, top\_hash\) <a id="Package.rollback"></a>

Set the "latest" version to the given hash.

**Arguments**

* **name\(str\)**:  Name of package to rollback.
* **registry\(str\)**:  Registry where package is located.
* **top\_hash\(str\)**:  Hash to rollback to.

## Package.diff\(self, other\_pkg\) <a id="Package.diff"></a>

Returns three lists -- added, modified, deleted.

Added: present in other\_pkg but not in self. Modified: present in both, but different. Deleted: present in self, but not other\_pkg.

**Arguments**

* **other\_pkg**:  Package to diff

**Returns**

added, modified, deleted \(all lists of logical keys\)

## Package.map\(self, f, include\_directories=False\) <a id="Package.map"></a>

Performs a user-specified operation on each entry in the package.

**Arguments**

* **f\(x, y\)**:  function

    The function to be applied to each package entry.

    It should take two inputs, a logical key and a PackageEntry.

* **include\_directories**:  bool

    Whether or not to include directory entries in the map.

Returns: list The list of results generated by the map.

## Package.filter\(self, f, include\_directories=False\) <a id="Package.filter"></a>

Applies a user-specified operation to each entry in the package, removing results that evaluate to False from the output.

**Arguments**

* **f\(x, y\)**:  function

    The function to be applied to each package entry.

    It should take two inputs, a logical key and a PackageEntry.

    This function should return a boolean.

* **include\_directories**:  bool

    Whether or not to include directory entries in the map.

**Returns**

A new package with entries that evaluated to False removed

