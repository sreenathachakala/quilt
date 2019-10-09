import datetime
import pathlib
from urllib.parse import urlparse, unquote

import pytz
import requests
import humanize

from .data_transfer import copy_file, get_bytes, put_bytes, delete_object, batch_delete_objects, list_objects
from .formats import FormatRegistry
from .packages import Package
from .search_util import search_api
from .util import (QuiltConfig, QuiltException, CONFIG_PATH,
                   CONFIG_TEMPLATE, configure_from_url, find_bucket_config, fix_url,
                   get_from_config, get_package_registry, parse_file_url, parse_s3_url,
                   read_yaml, validate_url, validate_package_name, write_yaml)


def copy(src, dest):
    """
    Copies ``src`` object from QUILT to ``dest``.

    Either of ``src`` and ``dest`` may be S3 paths (starting with ``s3://``)
    or local file paths (starting with ``file:///``).

    Parameters:
        src (str): a path to retrieve
        dest (str): a path to write to
    """
    copy_file(fix_url(src), fix_url(dest))


def put(obj, dest, meta=None):
    """Write an in-memory object to the specified QUILT ``dest``.

    Note:
        Does not work with all objects -- object must be serializable.

    You may pass a dict to ``meta`` to store it with ``obj`` at ``dest``.

    Parameters:
        obj: a serializable object
        dest (str): A URI
        meta (dict): Optional. metadata dict to store with ``obj`` at ``dest``
    """
    all_meta = {'user_meta': meta}
    clean_dest = fix_url(dest)
    ext = pathlib.PurePosixPath(unquote(urlparse(clean_dest).path)).suffix
    data, format_meta = FormatRegistry.serialize(obj, all_meta, ext)
    all_meta.update(format_meta)

    put_bytes(data, clean_dest, all_meta)


def get(src):
    """Retrieves src object from QUILT and loads it into memory.

    An optional ``version`` may be specified.

    Parameters:
        src (str): A URI specifying the object to retrieve

    Returns:
        tuple: ``(data, metadata)``.  Does not work on all objects.
    """
    clean_src = fix_url(src)
    data, meta = get_bytes(clean_src)
    ext = pathlib.PurePosixPath(unquote(urlparse(clean_src).path)).suffix

    return FormatRegistry.deserialize(data, meta, ext=ext), meta.get('user_meta')



def delete_package(package_name, registry=None):
    """
    Delete a package. Deletes only the manifest entries and not the underlying files.

    Parameters:
        package_name (str): Name of the package
        registry (str): The registry the package will be removed from
    """
    validate_package_name(package_name)

    if package_name not in list_packages(registry):
        raise QuiltException("No such package exists in the given directory.")

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)
    registry_url = urlparse(registry_base_path)

    if registry_url.scheme == 'file':
        raise NotImplementedError("Havent updated codepath since refactoring of .quilt folder")

    elif registry_url.scheme == 's3':
        bucket, path, _ = parse_s3_url(registry_url)
        s3_prefix_to_delete = path + f"/packages/package={package_name}"

        keys = [m['Key'] for m in list_objects(bucket, s3_prefix_to_delete)]
        batch_delete_objects(bucket, keys)  # TODO: This might not be the fastest way to wipe a keyspace

    else:
        raise NotImplementedError


def list_packages(registry=None):
    """ Lists Packages in the registry.

    Returns a list of each package+tophash in the registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A list of tuples (package_name, tophash, last_modified_time). last_modified_time is a datetime object
    """

    if registry is None:
        registry = get_from_config('default_local_registry')

    registry = fix_url(registry)
    packages_urlparse = urlparse(registry.rstrip('/') + '/.quilt/packages/')

    packages = []
    if packages_urlparse.scheme == 'file':
        raise NotImplementedError("Havent revisited this codepath since .quilt refactor")

    elif packages_urlparse.scheme == 's3':
        bucket_name, bucket_registry_path, _ = parse_s3_url(packages_urlparse)
        for manifest_obj in list_objects(bucket_name, bucket_registry_path):
            manifest_path = manifest_obj['Key']  # .../package=PACKAGE/hash_prefix=HP/HASH.jsonl

            manifest_path_segments = manifest_path.split("/")
            package_name = manifest_path_segments[-3].replace("package=", "")
            tophash = manifest_path_segments[-1].replace(".jsonl", "")
            last_modified_time = manifest_obj['LastModified']

            packages.append((package_name, tophash, last_modified_time))

    else:
        raise NotImplementedError

    return packages


def config(*catalog_url, **config_values):
    """Set or read the QUILT configuration.

    To retrieve the current config, call directly, without arguments:

        >>> import quilt3
        >>> quilt3.config()

    To trigger autoconfiguration, call with just the navigator URL:

        >>> quilt3.config('https://example.com')

    To set config values, call with one or more key=value pairs:

        >>> quilt3.config(navigator_url='http://example.com',
        ...               elastic_search_url='http://example.com/queries')

    Default config values can be found in `quilt3.util.CONFIG_TEMPLATE`.

    Args:
        catalog_url: A (single) URL indicating a location to configure from
        **config_values: `key=value` pairs to set in the config

    Returns:
        QuiltConfig: (an ordered Mapping)
    """
    if catalog_url and config_values:
        raise QuiltException("Expected either an auto-config URL or key=value pairs, but got both.")
    # Total distinction of args and kwargs -- config(catalog_url='http://foo.com')
    if catalog_url and len(catalog_url) > 1:
        raise QuiltException("`catalog_url` cannot be used with other `config_values`.")

    # Use given catalog's config to replace local configuration
    if catalog_url:
        catalog_url = catalog_url[0]

        # If catalog_url is empty, reset to the default config.

        if catalog_url:
            config_template = configure_from_url(catalog_url)
        else:
            config_template = read_yaml(CONFIG_TEMPLATE)
            write_yaml(config_template, CONFIG_PATH, keep_backup=True)
        return QuiltConfig(CONFIG_PATH, config_template)

    # Use local configuration (or defaults)
    if CONFIG_PATH.exists():
        local_config = read_yaml(CONFIG_PATH)
    else:
        local_config = read_yaml(CONFIG_TEMPLATE)

    # Write to config if needed
    if config_values:
        config_values = QuiltConfig('', config_values)  # Does some validation/scrubbing
        for key, value in config_values.items():
            local_config[key] = value
        write_yaml(local_config, CONFIG_PATH)

    # Return current config
    return QuiltConfig(CONFIG_PATH, local_config)

def search(query, limit=10):
    """
    Execute a search against the configured search endpoint.

    Args:
        query (str): query string to search
        limit (number): maximum number of results to return. Defaults to 10

    Query Syntax:
        By default, a normal plaintext search will be executed over the query string.
        You can use field-match syntax to filter on exact matches for fields in
            your metadata.
        The syntax for field match is `user_meta.$field_name:"exact_match"`.

    Returns:
        a list of objects with the following structure:
        ```
        [{
            "key": <key of the object>,
            "version_id": <version_id of object version>,
            "operation": <"Create" or "Delete">,
            "meta": <metadata attached to object>,
            "size": <size of object in bytes>,
            "text": <indexed text of object>,
            "source": <source document for object (what is actually stored in ElasticSeach)>,
            "time": <timestamp for operation>,
        }...]
        ```
    """
    raw_results = search_api(query, '*', limit)
    return raw_results['hits']['hits']

