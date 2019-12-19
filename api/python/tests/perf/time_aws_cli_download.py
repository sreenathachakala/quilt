import argparse
import subprocess
import time

def humanize_float(num): return "{0:,.2f}".format(num)
def run(cmd): return subprocess.check_output(cmd, shell=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("size", choices=["10kb", "100kb", "1mb", "10mb", "100mb", "1gb", "10gb"])

    args, leftovers = parser.parse_known_args()
    size = args.size

    for i in range(5):
        run("rm -rf ~/data/download_benchmark")
        run("mkdir -p ~/data/download_benchmark")
        start_file_count = run("ls -1 ~/data/download_benchmark | wc -l")
        start_time = time.time()
        run(f"aws s3 cp --recursive "
            f"s3://quilt-ml-data/data/download_benchmark/{size}/ "
            f"~/data/download_benchmark "
            f"> /dev/null")
        end_time = time.time()
        end_file_count = run("ls -1 ~/data/download_benchmark | wc -l")
        print(f"DownloadPerf-{size}",
              i+1,
              humanize_float(end_time-start_time),
              start_file_count.decode("utf-8").rstrip("\n"),
              end_file_count.decode("utf-8").rstrip("\n"))
