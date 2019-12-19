from pathlib import Path

import harness



from ec2_cluster.control import ClusterShell

SIZE="100mb"
aws_cli_download_script_loc = Path(__file__).parent/"time_aws_cli_download.py"

def cluster_setup_fn(sh: ClusterShell):
    sh.copy_from_local_to_all(aws_cli_download_script_loc.absolute(),
                              "/home/ubuntu/time_aws_cli_download.py")

def perf_test_fn(sh: ClusterShell, instance_type: str):
    sh.run_on_all(f"PYTHON_UNBUFFERED=True python /home/ubuntu/time_aws_cli_download.py {SIZE} > /home/ubuntu/{SIZE}.log")
    sh.copy_from_all_to_local(f"/home/ubuntu/{SIZE}.log",
                              f"/Users/armandmcqueen/code/quilt/api/python/tests/perf/{instance_type}/{SIZE}/")





if __name__ == '__main__':
    print(SIZE)
    instance_types = harness.m5_family
    results = harness.run_perf_test(instance_types, cluster_setup_fn, perf_test_fn)




