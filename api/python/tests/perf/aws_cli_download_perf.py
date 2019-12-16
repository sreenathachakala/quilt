from pathlib import Path

import harness



from ec2_cluster.control import ClusterShell


aws_cli_download_script_loc = Path(__file__).parent/"time_aws_cli_download.py"

def cluster_setup_fn(sh: ClusterShell):
    sh.copy_from_local_to_all(aws_cli_download_script_loc.absolute(),
                              "/home/ubuntu/time_aws_cli_download.py")

def perf_test_fn(sh):
    return sh.run_on_all("python /home/ubuntu/time_aws_cli_download.py")





if __name__ == '__main__':
    instance_types = harness.m5_family_mini
    results = harness.run_perf_test(instance_types, cluster_setup_fn, perf_test_fn)

    for instance_type, result_array in results.items():
        results = []
        for result_set in result_array:
            results.extend(result_set.stdout.split("\n"))
        print(instance_type, results)




