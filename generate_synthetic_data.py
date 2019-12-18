import os
import random
import time
from pathlib import Path

NUM_BYTES_PER_WRITE=64000


def gen_random_bytestring(num_bytes):
    return bytearray(random.getrandbits(8) for _ in range(num_bytes))

def generate_file(file_path, num_bytes):
    current_bytecount = 0
    with open(file_path, 'wb') as f:
        while True:
            remaining_bytes = num_bytes - current_bytecount
            # print(remaining_bytes)
            if remaining_bytes == 0:
                return

            next_write_len = NUM_BYTES_PER_WRITE if remaining_bytes > NUM_BYTES_PER_WRITE else remaining_bytes
            f.write(gen_random_bytestring(next_write_len))
            current_bytecount += next_write_len


def humanize_float(num): return "{0:,.2f}".format(num)


def kb(num):
    return num * 1000

def mb(num):
    return 1000 * kb(num)

def gb(num):
    return 1000 * mb(num)


def str_to_bytecount(size_str):
    size_str = size_str.lower()
    if size_str.endswith("gb"):
        cnt = int(size_str.replace("gb", ""))
        return gb(cnt)
    elif size_str.endswith("mb"):
        cnt = int(size_str.replace("mb", ""))
        return mb(cnt)
    elif size_str.endswith("kb"):
        cnt = int(size_str.replace("kb", ""))
        return kb(cnt)
    elif size_str.endswith("b"):
        cnt = int(size_str.replace("b", ""))
        return cnt
    else:
        raise ValueError("Unknown units")
    



def generate_dataset(base_path):
    total_dataset_size = gb(100)
    files_sizes = ["10kb", "100kb", "1mb", "10mb", "100mb", "1gb", "10gb"]

    # Make sure total_dataset_size is cleanly divisible by the file_sizes
    print("Confirming that total_dataset_size is evenly divisble by all file_sizes")
    for file_size_str in files_sizes:

        file_size = str_to_bytecount(file_size_str)
        assert total_dataset_size % file_size == 0, "Total dataset size must be evenly divisible by file_size"

    # Check that directories don't already exist
    print("Making sure the directories aren't already populated")
    for file_size_str in files_sizes:
        dir_loc = Path(base_path) / file_size_str
        if dir_loc.exists():
            raise RuntimeError("Directory already exists. Code must run in a clean directory")

    # Generate the files
    for file_size_str in files_sizes:
        print()
        print(f"Starting {file_size_str}")
        dir_loc = Path(base_path) / file_size_str
        dir_loc.mkdir(parents=True)
        file_size = str_to_bytecount(file_size_str)
        num_files = int(total_dataset_size / file_size)
        for i in range(1, num_files+1):
            file_path = dir_loc / f"file{i}"
            print(file_path, f"(total files = {num_files+1})")
            generate_file(file_path, file_size)
        

if __name__ == '__main__':
    generate_dataset("/tmp/synth_data/")






