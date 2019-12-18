import os
from pathlib import Path


def check(dir_path):
    dir_path = Path(dir_path)
    cnt = 0
    for file_name in os.listdir(dir_path):
        cnt += 1
        if cnt % 10_000 == 0:
            print(cnt)
        file_path = dir_path / file_name
        size = file_path.stat().st_size
        assert size == 10_000, f"File size should be 10_000, but is {size}"
    assert cnt == 10_000_000, f"cnt {cnt} should be 10_000_000"


if __name__ == '__main__':
    check("/tmp/synth_data")
