# Perf Test

Perf test uses `ec2-cluster` to spin up EC2 instances and run command on them. `ec2_config.yaml` holds information about how to spin up the EC2 instances using the Staging account.

You will need to be able to SSH to the instances to run the commands. This requires you to use a valid security group and for you to have the correct EC2 KeyPair. To use `ec2_config.yaml`, you need to add a rule to the [`quilt-ssh` security group](https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#SecurityGroups:search=sg-0614904d81858b700;sort=desc:groupName) that allows SSH from your IP. You also need to download the `perf-test.pem` and add it to your SSH agent. 
- The .pem is available in Secrets Manager [here](https://console.aws.amazon.com/secretsmanager/home?region=us-east-1#/secret?name=perf-test.pem) 
- To add it to your ssh-agent, run `ssh-add -K ~/path/to/perf-test.pem`.

Requires `ec2-cluster==0.4.0`.