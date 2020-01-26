import random
import string
import time

import click


def random_str(length, charsets=(string.ascii_uppercase, string.digits)):
    master_charset = []
    for charset in charsets:
        master_charset.extend(charset)
    return ''.join(random.choice(master_charset) for _ in range(length))

def random_sha256_lookalike(length):
    return random_str(length, charsets=["abcdef"+string.digits])


class PackageEntryBase:
    def __init__(self, logical_key, *args):
        self.logical_key = logical_key

    @property
    def physical_key(self):
        return NotImplementedError

    @property
    def entryhash(self):
        return NotImplementedError

    @property
    def size(self):
        return NotImplementedError

    @property
    def metadata(self):
        return NotImplementedError


class PackageEntryWithPhysicalKey:
    def __init__(self, logical_key, physical_key):
        self.logical_key = logical_key
        self.physical_key = physical_key

    @property
    def entryhash(self):
        return NotImplementedError

    @property
    def size(self):
        return NotImplementedError

    @property
    def metadata(self):
        return NotImplementedError





class PackageEntrySlots:
    __slots__ = ["logical_key"]
    def __init__(self, logical_key, *args):
        self.logical_key = logical_key

    @property
    def physical_key(self):
        return NotImplementedError

    @property
    def entryhash(self):
        return NotImplementedError

    @property
    def size(self):
        return NotImplementedError

    @property
    def metadata(self):
        return NotImplementedError

class PackageEntryWithPhysicalKeySlots:
    __slots__ = ["logical_key", "physical_key"]
    def __init__(self, logical_key, physical_key):
        self.logical_key = logical_key
        self.physical_key = physical_key

    @property
    def entryhash(self):
        return NotImplementedError

    @property
    def size(self):
        return NotImplementedError

    @property
    def metadata(self):
        return NotImplementedError

# See if there is object overhead
def tuple_package_entry(logical_key, *args):
    return (logical_key)

def tuple_package_entry_with_physical_key(logical_key, physical_key):
    return (logical_key, physical_key)


def generate_logical_key(i):
    # length should be roughly 50
    main_dir = f"dir{random.randint(0, 10)}"
    file_name = f"file{i}.file"
    return f"home/some/folder/that/is/v/long/{main_dir}/{file_name}"

def generate_physical_key(i):
    return f"s3://some-bucket/some-random-prefix--/{generate_logical_key(i)}?versionId={random_sha256_lookalike(33)}"



def profile_list_of_entries(entry_type):
    entries = []
    for i in range(10_000_000):
        logical_key = generate_logical_key(i)
        physical_key = generate_physical_key(i)
        entry = entry_type(logical_key, physical_key)
        entries.append(entry)
    return entries











@click.command()
@click.argument('entry_type_name')
def run(entry_type_name):
    entry_type_map = dict(
        base=PackageEntryBase,
        base_slots=PackageEntrySlots,
        base_tuple=tuple_package_entry,

        both=PackageEntryWithPhysicalKey,
        both_slots=PackageEntryWithPhysicalKeySlots,
        both_tuple=tuple_package_entry_with_physical_key,
    )

    entry_type = entry_type_map[entry_type_name]

    start = time.perf_counter()
    profile_list_of_entries(entry_type)
    end = time.perf_counter()
    print("Time elapsed:", "%.2f" % (end - start))


if __name__ == '__main__':
    # print(generate_logical_key(1))

    run()

