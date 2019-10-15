import pathlib
from urllib.parse import urlparse, unquote

from .data_transfer import copy_file, get_bytes, delete_url, put_bytes, list_objects, list_url
from .formats import FormatRegistry
from .search_util import search_api
from .util import (QuiltConfig, QuiltException, CONFIG_PATH,
                   CONFIG_TEMPLATE, configure_from_url, fix_url,
                   get_from_config, get_package_registry, parse_file_url, parse_s3_url,
                   read_yaml, validate_package_name, write_yaml)
from .packages import DotQuiltLayout


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



def delete_package(name, registry=None):
    """
    Delete a package. Deletes only the manifest entries and not the underlying files.

    Parameters:
        name (str): Name of the package
        registry (str): The registry the package will be removed from
    """
    validate_package_name(name)

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    manifest_dir_to_wipe = f"{registry_base_path}/{DotQuiltLayout.get_manifest_dir(name)}"
    tag_dir_to_wipe = f"{registry_base_path}/{DotQuiltLayout.get_tag_dir(name)}"

    manifest_paths = list(list_url(manifest_dir_to_wipe))
    tag_paths = list(list_url(tag_dir_to_wipe))

    if not manifest_paths and not tag_paths:
        raise QuiltException("No such package exists!")

    for path, _ in manifest_paths:
        delete_url(f"{manifest_dir_to_wipe}/{path}")

    for path, _ in tag_paths:
        delete_url(f"{tag_dir_to_wipe}/{path}")

    # Will ignore non-empty dirs.
    delete_url(manifest_dir_to_wipe)
    delete_url(tag_dir_to_wipe)


def list_packages(registry=None):
    """Lists Packages in the registry.

    Returns a sequence of all packages in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A list of strings containing the names of the packages
    """
    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    package_dir = f"{fix_url(registry_base_path)}/{DotQuiltLayout.get_global_manifest_dir()}"
    scheme = urlparse(package_dir)
    if scheme == "file":
        global_package_dir = pathlib.Path(package_dir)
        package_names_with_prefix = [str(package_dir.relative_to(global_package_dir))
                                     for package_dir
                                     in global_package_dir.iterdir()]

    elif scheme == 's3':
        package_names_with_prefix, _ = list_objects(bucket=registry,
                                                     prefix=f"{DotQuiltLayout.get_global_manifest_dir()}/",
                                                     recursive=False)

    else:
        raise NotImplementedError(f"We only support file and s3 urls, not {scheme}")

    package_names = []
    for package_name_with_prefix in package_names_with_prefix:
        partition_key_prefix = 'package='
        assert package_name_with_prefix.startswith(partition_key_prefix), f"The package dir should start with " \
            f"'{partition_key_prefix}'.\n" \
            f"Instead got: {package_name_with_prefix}"
        package_name = package_name_with_prefix[:len(partition_key_prefix)]
        package_names.append(package_name)

    return package_names


def list_package_versions(name, registry=None):
    """Lists versions of a given package.

    Returns a sequence of (version, hash) of a package in a registry.
    If the registry is None, default to the local registry.

    Args:
        registry(string): location of registry to load package from.

    Returns:
        A sequence of tuples containing the package name and hash.
    """
    # TODO(armand): The semantics of this API have changed
    validate_package_name(name)

    registry_base_path = get_package_registry(fix_url(registry) if registry else None)

    manifest_dir_url = f'{registry_base_path}/{DotQuiltLayout.get_manifest_dir(name)}/'

    for path, _ in list_url(manifest_dir_url):
        filename = path.split('/')[-1]
        assert filename.endswith(".jsonl"), f"A manifest file should end in .jsonl. Instead got: {filename}"
        hash = filename[:-len(".jsonl")]
        yield name, hash





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
        [simple query string query](https://www.elastic.co/guide/en/elasticsearch/reference/6.8/query-dsl-simple-query-string-query.html)


    Returns:
        a list of objects with the following structure:
        ```
        [{
            "_id": <document unique id>
            "_index": <source index>,
            "_score": <relevance score>
            "_source":
                "key": <key of the object>,
                "size": <size of object in bytes>,
                "user_meta": <user metadata from meta= via quilt3>,
                "last_modified": <timestamp from ElasticSearch>,
                "updated": <object timestamp from S3>,
                "version_id": <version_id of object version>
            "_type": <document type>
        }, ...]
        ```
    """
    raw_results = search_api(query, '*', limit)
    return raw_results['hits']['hits']

