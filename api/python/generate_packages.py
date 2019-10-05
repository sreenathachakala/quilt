import pandas as pd
import numpy as np
import quilt3
import random
from pathlib import Path
import boto3

DF_ROWS = 100
DF_COLS = 100
MAX_NUM_ENTRIES_TO_UPDATE = 20
tmpdir = Path(__file__).parent / "data_dir"

def gen_dataframe(rows=1_000, cols=1_000):
    df = pd.DataFrame(np.random.randint(0, 100, size=(rows, cols)))
    return df


def gen_package_name(package_number):
    return f"manifesttest/testpkg{package_number}"

def gen_logical_key(package_name, package_entry_number):
    return f"{package_name}:entry{package_entry_number}.parquet"

def write_manifest_to_proposed_partitioned_location(package_name, pkg):
    """
    USER
    PACKAGE
    YEAR
    MONTH
    DAY
    HASH 
    """
    user, package = package_name.split("/")
    year = random.choice([2017, 2018, 2019])
    month = random.choice(list(range(1, 13)))
    if len(str(month)) == 1:
        month = f"0{month}"
    day = random.choice(list(range(1, 28)))
    if len(str(day)) == 1:
        day = f"0{day}"
    hash = pkg.top_hash

    bucket = "armand-staging-t4"
    current_manifest_key = f".quilt/packages/{hash}"

    proposed_manifest_key = f".quilt-test/user={user}/package={package}/date={year}-{month}-{day}/hash={hash}/manifest.jsonl"

    s3 = boto3.session.Session(profile_name='staging').client("s3")
    response = s3.copy_object(Bucket=bucket,
                              CopySource={"Bucket": bucket, "Key": current_manifest_key},
                              Key=proposed_manifest_key)
    print(response)



def pick_random_logical_keys_to_be_updated(package_name, entries_in_package):
    assert MAX_NUM_ENTRIES_TO_UPDATE < entries_in_package
    num_updates = random.randint(1, MAX_NUM_ENTRIES_TO_UPDATE)
    logical_keys_to_update = [gen_logical_key(package_name, i)
                              for i
                              in random.sample(list(range(entries_in_package)), num_updates)]
    return logical_keys_to_update


def gen_packages(num_packages, versions_per_package, entries_per_package):
    for i in range(num_packages):
        package_name = gen_package_name(i)
        print("Creating package:", package_name)

        pkg = quilt3.Package()

        for e in range(entries_per_package):
            print("For package", package_name, "initial version, creating entry", e+1)
            pkg.set(gen_logical_key(package_name, e),
                    gen_dataframe(DF_ROWS, DF_COLS),
                    serialization_location=tmpdir/gen_logical_key(package_name, e))

        print("Starting push package", package_name, "initial commit")
        pkg.push(package_name,
                 "s3://armand-staging-t4",
                 message=f"Package {i} initial commit")
        print("Complete push package", package_name, "initial commit")
        print("Copying manifest to new location")
        write_manifest_to_proposed_partitioned_location(package_name, pkg)
        print("Finished copying manifest to new location")


        for v in range(versions_per_package):
            print("Creating new version number", v+1, "of package", package_name)
            logical_keys_to_update = pick_random_logical_keys_to_be_updated(package_name, entries_per_package)
            print("Updating", len(logical_keys_to_update), "keys")
            for i, lk in enumerate(logical_keys_to_update):
                print("Package", package_name, "version", v+1, "entry update", i+1, "of", len(logical_keys_to_update))
                pkg.set(lk,
                        gen_dataframe(DF_ROWS, DF_COLS),
                        serialization_location=tmpdir/lk)

            print("Starting push package", package_name, "new version", v+1)
            pkg.push(package_name,
                     "s3://armand-staging-t4",
                     message=f"Package {i} update {v+1}")
            print("Completed push package", package_name, "new version", v + 1)
            print("Copying manifest to new location")
            write_manifest_to_proposed_partitioned_location(package_name, pkg)
            print("Finished copying manifest to new location")




if __name__ == '__main__':
    quilt3.config("https://armand-staging.quiltdata.com")
    # quilt3.login()

    num_packages = 1
    versions_per_package = 5
    entries_per_package = 100

    gen_packages(num_packages, versions_per_package, entries_per_package)

