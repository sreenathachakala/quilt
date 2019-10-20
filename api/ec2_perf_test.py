#!/usr/bin/env python3

import quilt3
from quilt3 import Package
import uuid

import time

def humanize_float(num): return "{0:,.2f}".format(num)

class Timer:
    def __init__(self, name):
        self.name = name
        self.t1 = None
        self.t2 = None

    def start(self):
        print(f'Timer "{self.name}" starting!')
        self.t1 = time.time()

        return self

    def stop(self):
        self.t2 = time.time()
        print(f'Timer "{self.name}" took {humanize_float(self.t2-self.t1)} seconds')


def perf_test_set():
    pkg = Package()
    data_dir = "/Users/armandmcqueen/data/coco/val2017/"
    # data_dir = "/Users/armandmcqueen/data/coco/"

    # data_dir = "/home/ubuntu/data/coco/"
    # data_dir = "/home/ubuntu/data/coco/val2017"
    t = Timer(f"pkg.set_dir({data_dir})").start()
    pkg.set_dir("data", data_dir)
    t.stop()
    return pkg

def perf_test():
    pkg = perf_test_set()
    perf_test_hashing(pkg)
    perf_test_materialize(pkg)




def perf_test_hashing(pkg):
    thash = Timer("hash files").start()
    pkg._fix_sha256()
    thash.stop()

def perf_test_materialize(pkg):
    test_unique_id = uuid.uuid4()
    tpush = Timer(f"materialize files, test={test_unique_id}").start()
    pkg._materialize(dest_url=f"s3://quilt-ml-data/tst/{test_unique_id}/")
    tpush.stop()


if __name__ == '__main__':
    perf_test()

    # Laptop quick materialize test
    # ~/data/coco/val2017
