from pathlib import Path
import time

from ec2_cluster.infra import ConfigCluster
from ec2_cluster.control import ClusterShell

config_path = Path(__file__).parent/"ec2_config.yaml"

m5_family_mini = [
    # "m5.2xlarge",
    "m5.4xlarge"
]

m5_family = [
        # "m5.large",
        "m5.xlarge",
        "m5.2xlarge",
        "m5.4xlarge",
        "m5.8xlarge",
        "m5.12xlarge",
        "m5.16xlarge",
        "m5.24xlarge",
    ]

c5_family = [
        "c5.large",
        "c5.xlarge",
        "c5.2xlarge",
        "c5.4xlarge",
        "c5.9xlarge",
        "c5.12xlarge",
        "c5.18xlarge",
        "c5.24xlarge",
    ]



def create_or_get_cluster(instance_type, instance_count, ssh_key_path, config_yaml=config_path, unique_id=None):

    cluster_template_name = f"quilt-perf-test-{instance_type}"
    if unique_id is not None:
        cluster_template_name += f"-{unique_id}"

    cluster = ConfigCluster(config_yaml.absolute(),
                            other_args={
                                "instance_type": instance_type,
                                "node_count": instance_count,
                                "cluster_template_name": cluster_template_name
                            })

    is_first_launch = not cluster.any_node_is_running_or_pending()
    if is_first_launch:
        cluster.launch(verbose=True)

    sh = ClusterShell(username="ubuntu",
                      master_ip=cluster.public_ips[0],
                      worker_ips=cluster.public_ips[1:],
                      ssh_key_path=ssh_key_path)

    print("IPs")
    for ip in cluster.public_ips:
        print(f"ssh -A ubuntu@{ip}")
    print("---")

    if is_first_launch:
        while True:
            try:
                sh.run_on_all("hostname")
                break
            except Exception:
                print("Exception when SSHing to instances for the first time")
                time.sleep(2)


    return cluster, sh, is_first_launch






def run_perf_test(instance_types, cluster_setup_fn, perf_test_fn):
    instance_count = 4
    ssh_key_path = Path("/Users/armandmcqueen/.ssh/perf-test.pem")
    unique_id = "armand"

    all_results = {}
    for instance_type in instance_types:
        print("Instance Type:", instance_type)
        cluster, sh, is_first_launch = create_or_get_cluster(instance_type,
                                                             instance_count,
                                                             ssh_key_path,
                                                             unique_id=unique_id)
        if is_first_launch:
            cluster_setup_fn(sh)

        instance_type_results = perf_test_fn(sh, instance_type)

        all_results[instance_type] = instance_type_results

        cluster.terminate(verbose=True)

    return all_results


