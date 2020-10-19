# Technical Reference

## Run Quilt in Your AWS Account

Quilt is a versioned data portal for AWS. A Quilt _instance_ is a private portal that runs in your virtual private cloud \(VPC\). Each instance consists of a password-protected web catalog on your domain, backend services, a secure server to manage user identities, and a Python API.

### Installation Instructions

We encourage users to contact us before deploying Quilt. We will make sure that you have the latest version of Quilt, and walk you through the CloudFormation deployment.

We recommend that all users do one or more of the following:

* [Schedule a Quilt engineer](https://www.meetingbird.com/m/quilt-install) to guide you through the installation
* [Join Quilt on Slack](https://slack.quiltdata.com/) to ask questions and connect with other users
* [Email Quilt](mailto://contact@quiltdata.io)

### Before you install Quilt

You will need the following:

1. **An AWS account**
2. **IAM Permissions** to run the CloudFormation template \(or Add products in Service Catalog\). The `AdministratorAccess` policy is sufficient. \(Quilt creates and manages a VPC, containers, S3 buckets, a database, and more.\) If you wish to create a service role for the installation, visit `IAM > Roles > Create Role > AWS service > CloudFormation` in the AWS console. The following service role is equivalent to `AdministratorAccess`:

   ```javascript
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "*",
                "Resource": "*"
            }
        ]
    }
   ```

3. The **ability to create DNS entries**, such as CNAME records, for your company's domain.
4. **An SSL certificate in the same region as your Quilt instance** to secure the domain where your users will access your Quilt instance. For example, to make your Quilt catalog available at `https://quilt.mycompany.com`, you require a certificate for `*.mycompany.com` in the [AWS Certificate Manager](https://aws.amazon.com/certificate-manager/). You may either [create a new certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html), or [import an existing certificate](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html).
5. For maximum security, Quilt requires **a region that supports** [**AWS Fargate**](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/). As of this writing, all U.S. regions support Fargate.
6. **An S3 Bucket** for your team data. This may be a new or existing bucket. The bucket should not have any notifications attached to it \(S3 Console &gt; Bucket &gt; Properties &gt; Events\). Quilt will need to install its own notifications. Installing Quilt will modify the following Bucket characteristics:
   * Permissions &gt; CORS configuration \(will be modified for secure web access\)
   * Properties &gt; Versioning \(will be enabled\)
   * Properties &gt; Object-level logging \(will be enabled\)
   * Properties &gt; Events \(will add one notification\)
7. A **subdomain that is as yet not mapped in DNS** where users will access Quilt on the web. For example `quilt.mycompany.com`.
8. Available **CloudTrail Trails** in the region where you wish to host your stack \([learn more](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/WhatIsCloudTrail-Limits.html)\).
9. An active subscription to Quilt Business on AWS Marketplace. Click `Continue to Subscribe` on the [Quilt Business Listing](https://aws.amazon.com/marketplace/pp/B07QF1VXFQ) to subscribe then return to this page for installation instructions. **The CloudFormation template and instructions on AWS Marketplace are infrequently updated and may be missing critical bugfixes.**

#### AWS Marketplace

You can install Quilt via AWS Marketplace. As indicated above, we recommend that you [contact us first](technical-reference.md#installation-instructions).

#### AWS Service Catalog

1. Email [contact@quiltdata.io](mailto:contact@quiltdata.io) with your AWS account ID to request access to Quilt through the AWS Service Catalog and to obtain a license key.
2. Click the service catalog link that you received from Quilt. Arrive at the Service Catalog. Click IMPORT, lower right.

   ![](../.gitbook/assets/import%20%281%29.png)

3. Navigate to Admin &gt; Portfolios list &gt; Imported Portfolios. Click Quilt Enterprise.

   ![](../.gitbook/assets/portfolio%20%281%29.png)

4. On the Portfolio details page, click ADD USER, GROUP OR ROLE. Add any users, **including yourself**, whom you would like to be able to install Quilt.

   ![](../.gitbook/assets/portfolio-users%20%281%29.png)

5. Click Products list, upper left. Click the menu to the left of Quilt CloudFormation Template. Click Launch product. \(In the future, use the same menu to upgrade Quilt when a new version is released.\)

   ![](../.gitbook/assets/products-list%20%281%29.png)

6. Continue to the [CloudFormation](technical-reference.md#CloudFormation) section. Note: the following screenshots may differ slightly fromm what you see in Service Catalog.

#### CloudFormation

1. Specify stack details in the form of a stack _name_ and CloudFormation _parameters_. Refer to the descriptions displayed above each text box for further details. Service Catalog users require a license key. See [Before you install Quilt](technical-reference.md#before-you-install-quilt) for how to obtain a license key.

   ![](../.gitbook/assets/stack-details%20%281%29.png)

2. Service Catalog users, skip this step. Under Stack creation options, enable termination protection.

   ![](../.gitbook/assets/term_protect%20%281%29.png)

   This protects the stack from accidental deletion. Click Next.

3. Service Catalog users, skip this step. Check the box asking you to acknowledge that CloudFormation may create IAM roles, then click Create.

   ![](../.gitbook/assets/finish%20%281%29.png)

4. CloudFormation takes about 30 minutes to create the resources for your stack. You may monitor progress under Events. Once the stack is complete, you will see `CREATE_COMPLETE` as the Status for your CloudFormation stack.

   ![](../.gitbook/assets/events%20%281%29.png)

5. To finish the installation, you will want to view the stack Outputs.

   ![](../.gitbook/assets/outputs%20%281%29.png)

   In a separate browser window, open the DNS settings for your domain. Create the following `CNAME` records. **Replace italics** with the corresponding stack Outputs.

   | CNAME | Value |
   | :--- | :--- |
   | _QuiltWebHost Key_ | _LoadBalancerDNSName_ |
   | _RegistryHostName Key_ | _LoadBalancerDNSName_ |
   | _S3ProxyHost Key_ | _LoadBalancerDNSName_ |

6. Quilt is now up and running. You can click on the _QuiltWebHost_ value in Outputs and log in with your administrator password to invite users.

### Advanced configuration

The default Quilt settings are adequate for most use cases. The following section covers advanced customization options.

#### Use Google to sign into Quilt

You can enable users on your Google domain to sign in to Quilt. Refer to [Google's instructions on OAuth2 user agents](https://developers.google.com/identity/protocols/OAuth2UserAgent) and create authorization credentials to identify your Quilt stack to Google's OAuth 2.0 server.

![](../.gitbook/assets/google_console%20%281%29.png)

In the template menu \(CloudFormation or Service Catalog\), select Google under _User authentication to Quilt_. Enter the domain or domains of your Google apps account under _SingleSignOnDomains_. Enter the _Client ID_ of the OAuth 2.0 credentials you created into the field labeled _GoogleClientId_

![](../.gitbook/assets/google_auth%20%281%29.png)

#### Preparing an AWS Role for use with Quilt

These instructions document how to set up an existing role for use with Quilt. If the role you want to use doesn't exist yet, create it now.

Go to your Quilt stack in CloudFormation. Go to `Outputs`, then find `RegistryRoleARN` and copy its value. It should look something like this: `arn:aws:iam::000000000000:role/stackname-ecsTaskExecutionRole`.

Go to the IAM console and navigate to `Roles`. Select the role you want to use. Go to the `Trust Relationships` tab for the role, and select `Edit Trust Relationship`. The statement might look something like this:

```javascript
{
  "Version": "2012-10-17",
  "Statement": [
    "... one or more statements"
  ]
}
```

Add an object to the beginning of the Statement array with the following contents:

```javascript
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "$YOUR_REGISTRY_ROLE_ARN"
  },
  "Action": "sts:AssumeRole"
},
```

Note the comma after the object. Your trust relationship should now look something like this:

```javascript
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "$YOUR_REGISTRY_ROLE_ARN"
      },
      "Action": "sts:AssumeRole"
    },
    "... whatever was here before"
  ]
}
```

You can now configure a Quilt Role with this role \(using the Catalog's admin panel, or `quilt3.admin.create_role`\).

## Mental model for a Quilt package

Quilt represents datasets as _packages_. A package is an immutable collection of related files with a handle of the form `AUTHOR/DESCRIPTION`, a cryptographic _top-hash_ \(or hash of hashes\) that uniquely identifies package contents, and a backing _manifest_.

The manifest is serialized as file that contains _entries_. Manifest entries are tuples of the following form:

`(LOGICAL_KEY, PHYSICAL_KEYS, HASH, METADATA)`

_Logical keys_ are user-facing friendly names, like `"README.md"`. _Physical keys_ are fully qualified paths to bytes on disk, or bytes in S3. A _hash_ is a digest of the physical key's contents, usually SHA-256. _Metadata_ are a dictionary that may contain user-defined keys for metadata like bounding boxes, labels, or provenance information \(e.g. {"algorithm\_version": "4.4.1"} to indicate how a given file was created\).

Package manifests are stored in _registries_. Quilt supports both local disk and Amazon S3 buckets as registry. A registry may store manifests as well as the primary data. S3 was chosen for its widespread adoption, first-class versioning support, and cost/performance profile. The Quilt roadmap includes plans to support more storage formats in the future \(e.g. GCP, Azure, NAS, etc.\).

By way of illustration first entry of a package manifest for the COCO machine learning dataset are shown below.

```javascript
{
    "logical_key": "annotations/captions_train2017.json",
    "physical_keys":
    ["s3://quilt-ml-data/data/raw/annotations/captions_train2017.json?versionId=UtzkAN8FP4irtroeN9bfYP1yKzX7ko3G"],
    "size": 91865115,
    "hash": {
    "type": "SHA256",
    "value":
    "4b62086319480e0739ef390d04084515defb9c213ff13605a036061e33314317"},
    "meta": {}
}
```

