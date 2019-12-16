import subprocess
import time

def humanize_float(num): return "{0:,.2f}".format(num)
def run(cmd): return subprocess.check_output(cmd, shell=True)


if __name__ == '__main__':
    for i in range(5):
        run("rm -rf ~/data/coco")
        run("mkdir -p ~/data/coco")
        start_file_count = run("ls -1 ~/data/coco | wc -l")
        start_time = time.time()
        run("aws s3 cp --recursive s3://quilt-ml-data/cv/coco2017/val2017 ~/data/coco > /dev/null")
        end_time = time.time()
        end_file_count = run("ls -1 ~/data/coco | wc -l")
        print("DownloadPerf",
              i+1,
              humanize_float(end_time-start_time),
              start_file_count.decode("utf-8").rstrip("\n"),
              end_file_count.decode("utf-8").rstrip("\n"))
