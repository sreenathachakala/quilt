import os
import random
import time
import multiprocessing as mp
from tqdm import tqdm
import multiprocessing
import itertools
import random
from pathlib import Path

NUM_BYTES_PER_WRITE=64000


def gen_random_bytestring(num_bytes):
    return bytearray(random.getrandbits(8) for _ in range(num_bytes))

def generate_file_multiprocessing(args):
    assert len(args) == 3
    file_path, num_bytes, q = args
    generate_file(file_path, num_bytes)
    q.put(1)

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
    # total_dataset_size = gb(100)
    # files_sizes = ["10kb", "100kb", "1mb", "10mb", "100mb", "1gb", "10gb"]
    # files_sizes = ["100kb", "1mb", "10mb", "100mb", "1gb", "10gb"]
    datasets = [
        ("100kb", gb(1)),  # 10,000 files
        ("1mb", gb(10)),  # 10,000
        ("10mb", gb(10)),  # 1000
        ("100mb", gb(10)), # 100
        ("1gb", gb(10))  # 10
    ]

    # Make sure total_dataset_size is cleanly divisible by the file_sizes
    print("Confirming that total_dataset_size is evenly divisible by all file_sizes")
    for file_size_str, dataset_size in datasets:

        file_size = str_to_bytecount(file_size_str)
        assert dataset_size % file_size == 0, "Total dataset size must be evenly divisible by file_size"

    # Check that directories don't already exist
    print("Making sure the directories aren't already populated")
    for file_size_str, dataset_size in datasets:
        dir_loc = Path(base_path) / file_size_str
        if dir_loc.exists():
            raise RuntimeError(f"Directory {dir_loc} already exists. Code must run in a clean directory")

    # Generate the files
    for file_size_str, dataset_size in datasets:
        print()
        print(f"Starting {file_size_str}")
        dir_loc = Path(base_path) / file_size_str
        dir_loc.mkdir(parents=True)
        file_size = str_to_bytecount(file_size_str)
        num_files = int(dataset_size / file_size)

        m = multiprocessing.Manager()
        shared_queue = m.Queue()
        num_workers = 20
        progress = 0

        file_paths = [dir_loc / f"file{i}" for i in range(1, num_files+1)]

        with multiprocessing.Pool(num_workers) as p:
            async_results = p.map_async(generate_file_multiprocessing, zip(file_paths,
                                                           itertools.repeat(file_size),
                                                           itertools.repeat(shared_queue)))
            with tqdm(desc="Progress", total=num_files) as tqdm_progress:
                while True:
                    progress_update = shared_queue.get(block=True)
                    progress += progress_update
                    tqdm_progress.update(progress_update)

                    if progress == num_files:
                        break

            assert async_results.successful(), "There was an uncaught error"







if __name__ == '__main__':
    generate_dataset("/tmp/synth_data/")






