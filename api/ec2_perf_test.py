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
    # data_dir = "/home/ubuntu/coco/data/train2017/"
    # data_dir = "/Users/armandmcqueen/data/coco/val2017/"
    data_dir = "/Users/armandmcqueen/data/coco/"

    # data_dir = "/home/ubuntu/coco/data/"
    t = Timer(f"pkg.set_dir({data_dir})").start()
    pkg.set_dir("data", data_dir)
    t.stop()
    return pkg

def perf_test():
    pkg = perf_test_set()
    perf_test_hashing(pkg)
    # perf_test_materialize(pkg)




def perf_test_hashing(pkg):
    thash = Timer("hash files").start()
    pkg._fix_sha256()
    thash.stop()

def perf_test_materialize(pkg):
    tpush = Timer("materialize files").start()
    pkg._materialize(dest_url=f"s3://quilt-ml-data/tst/{uuid.uuid4()}/")
    tpush.stop()


if __name__ == '__main__':
    perf_test()

    # Laptop quick test val2017
    # Note: There is caching happening somewhere that makes the first run slightly slower (~1-2seconds).
    #       These numbers are from the second run onwards
    # [Original-Laptop] : 12-14 seconds
    # [With processes and queue - Laptop]: 2.6 seconds (2 workers)
    #                                      2.3 seconds (4 workers)

    # Laptop test = annotations + val2017 + train2017 (39875 only=6.1G) =  8.17GB
    # [Original-Laptop] = 159-168seconds, only two 'cores' were used
    # [New-laptop]= 40 seconds, (number of cores, 4 processes used)
    #               60seconds when restricted to 2 processes (only 2 cores in use)
    #               30-33 seconds (6 processes)

    # Cloud VM test = coco 2017, 59.6 GB
    # [New-m5.8xl-32vcpu] = 472seconds. 120seconds 2nd time onwards (wtf). 441s after reboot (32 processes)
    # [Original-m5.8xl-32vcpu] = 690 after reboot. 630 2nd time onwards.
