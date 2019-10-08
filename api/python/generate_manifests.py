import boto3
import json
import jsonlines
import io
import string
import random
from randomword import RandomWord
import time
import multiprocessing
r = RandomWord()

BUCKET = "armand-staging-t4"
# boto3sess = boto3.session.Session(profile_name='staging')
boto3sess = boto3.session.Session()

possible_chars = list("abcdef")
possible_chars.extend(string.digits)

def random_string(length=30):
    return ''.join([random.choice(possible_chars) for n in range(length)])


def validate_entry(entry):
    """
    Cehck that the entry has a:
    - logical_key: str
    - physical_keys: list of str, len=1
    - size: int
    - hash: dict {"type": "SHA256", "value": str}
    - meta: dict
    """
    assert isinstance(entry, dict)

    keys = entry.keys()
    assert 'logical_key' in keys
    assert isinstance(entry['logical_key'], str)

    assert 'physical_keys' in keys
    assert isinstance(entry['physical_keys'], list)
    assert len(entry['physical_keys']) == 1
    assert isinstance(entry['physical_keys'][0], str)

    assert 'size' in keys
    assert isinstance(entry['size'], int)

    assert 'hash' in keys
    assert isinstance(entry['hash'], dict)
    assert 'type' in entry['hash'].keys()
    assert entry['hash']['type'] == 'SHA256'
    assert 'value' in entry['hash'].keys()
    assert isinstance(entry['hash']['value'], str)

    assert 'meta' in keys
    assert isinstance(entry['meta'], dict)


def stringify_time_element(t):
    if len(str(t)) == 1:
        return f"0{t}"
    return str(t)

class Manifest:
    def __init__(self, user, package, commit_message, entries, hash=None):
        if hash is None:
            hash = random_string()

        for entry in entries:
            validate_entry(entry)
        self.entries = entries
        self.user = user
        self.package = package
        self.hash = hash

        self.year = random.choice([2017, 2018, 2019])
        self.month = stringify_time_element(random.choice(list(range(1, 13))))
        self.day = stringify_time_element(random.choice(list(range(1, 28))))
        self.hour = stringify_time_element(random.choice(list(range(0, 24))))
        self.minute = stringify_time_element(random.choice(list(range(0, 60))))
        self.sec = stringify_time_element(random.choice(list(range(0, 60))))

        self.ts = f"{self.year}-{self.month}-{self.day} {self.hour}:{self.minute}:{self.sec}"
        self.meta = {"version": "v0",
                     "message": commit_message,
                     "package_hash": self.hash,
                     "ts": self.ts}

        for i in range(len(self.entries)):
            self.entries[i]["package_hash"] = self.hash

    def s3_key(self):
        # return f".quilt-test-5/user={self.user}/package={self.package}/{self.hash}.jsonl"
        hash_prefix = self.hash[:2]
        return f".quilt-test-6/user={self.user}/package={self.package}/hash_prefix={hash_prefix}/{self.hash}.jsonl"

    def as_jsonl_bytes(self):
        fp = io.BytesIO()
        lines = [self.meta] + self.entries
        with jsonlines.Writer(fp) as writer:
            writer.write_all(lines)
        fp.seek(0)
        return fp.read()


    def write_to_s3(self, timed=False):
        s3 = boto3sess.client("s3")
        if timed:
            ser_start = time.time()
        jsonl_bytes = self.as_jsonl_bytes()
        if timed:
            ser_end = time.time()
            print(f"Serialization took {ser_end-ser_start} seconds")
        while True:
            try:
                response = s3.put_object(
                    Body=jsonl_bytes,
                    Bucket=BUCKET,
                    Key=self.s3_key())
                break
            except Exception as e:
                print("Exception, retrying in 1 second.", str(e))
                time.sleep(1)
        if timed:
            put_end = time.time()
            print(f"Put took {put_end-ser_end} seconds")
        # print(self.user, self.package, self.meta)

    def pretty_print(self):
        print(f"==========={self.user}/{self.package}@{self.hash}===========")
        print(self.meta)
        for entry in self.entries:
            print(entry)



def gen_meta(num_meta_fields=5):
    m = {}
    for i in range(1, num_meta_fields+1):
        key = f"meta_field_{i}"
        value = r.get()['word']
        m[key] = value
    return m


def generate_entry(user, package, version, entry_num):
    logical_key = f"{user}/{package}/{entry_num}.parquet"
    physical_key = f"s3://{BUCKET}/data/{user}/{package}/v{version}/{entry_num}.parquet"
    size = random.randint(0, 100_000)
    hash = {"type": "SHA256", "value": random_string()}
    meta = gen_meta()

    return {
        "logical_key": logical_key,
        "physical_keys": [physical_key],
        "size": size,
        "hash": hash,
        "meta": meta
    }


def update_some_entries(entries, user, package, version, prob=0.2):
    new_entries = []
    for i, entry in enumerate(entries):
        if random.random() <= prob:
            new_entry = generate_entry(user, package, version, i)
        else:
            new_entry = entry
        new_entries.append(json.loads(json.dumps(new_entry)))
    return new_entries


def gen_package(user, package, num_versions, num_entries=100, update_prob=0.2, verbose=False):
    manifests = []
    entries = [generate_entry(user, package, 0, i) for i in range(num_entries)]
    manifest = Manifest(user, package, "Base manifest", entries)
    manifests.append(manifest)
    if verbose:
        manifest.pretty_print()

    for i in range(1, num_versions):
        entries = update_some_entries(manifest.entries, user, package, i, prob=update_prob)
        manifest = Manifest(user, package, f"Manifest update {i}", entries)
        if verbose:
            print()
            manifest.pretty_print()
        manifests.append(manifest)
    return manifests




"""
[DONE] 1. Generate a manifest
[DONE] 2. Generate manifest entries
[DONE] 3. Generate new manifest by altering current manifest
4. Generate and write 1M manifests (10 users x 100 packages x 1000 hashes)
"""

def push(manifest):
    manifest.write_to_s3(timed=False)






NUM_VERSIONS = 1000
NUM_ENTRIES = 1000

def gen_and_push_manifest(arg_tuple):
    user_num, package_num = arg_tuple
    user = f"user{user_num}"
    pkg = f"pkg{package_num}"
    manifests = gen_package(user, pkg, num_versions=NUM_VERSIONS, num_entries=NUM_ENTRIES, update_prob=0.2)
    print("Generated manifests for", user, pkg)
    for m in manifests:
        push(m)
    print("Pushed manifests for", user, pkg)

if __name__ == '__main__':

    NUM_USERS = 10
    NUM_PACKAGES = 100



    for u in range(NUM_USERS):
        arg_tuples = []

        for p in range(NUM_PACKAGES):
            arg_tuples.append((u, p))

        p = multiprocessing.Pool(50)
        p.map(gen_and_push_manifest, arg_tuples)

        print(f"Done with user{u}")




