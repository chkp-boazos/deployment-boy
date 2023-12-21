import { getStack, Config } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { readFileSync } from "fs";

const publicKeyPath = new Config().require("publicKeyPath");
const publicKey = readFileSync(publicKeyPath, "utf-8");
const privateKeyPath = publicKeyPath.slice(0, -1 * ".pub".length);

const userData = `#!/bin/bash
mkdir -p /opt/k3s
wget -O /opt/k3s/install.sh https://get.k3s.io
chmod +x /opt/k3s/install.sh
`;

const ec2Image = aws.ec2.getAmi({
  mostRecent: true,
  owners: ["099720109477"],
  filters: [{
    name: "name",
    values: ["ubuntu/images/hvm-ssd/ubuntu-*-20.04-amd64-server-*"],
  }],
});

const allowSSH = new aws.ec2.SecurityGroup("allow-ssh", {
  name: `allow-ssh-for-debug-${getStack()}`,
  description: "Allow SSH to machine",
  ingress: [{
    description: "SSH for everyone",
    fromPort: 22,
    toPort: 22,
    protocol: "tcp",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  egress: [{
    fromPort: 0,
    toPort: 0,
    protocol: "-1",
    cidrBlocks: ["0.0.0.0/0"],
  }],
  tags: {
    App: "onboarding-cloudguard",
  }
});

const keyPair = new aws.ec2.KeyPair("ssh-key-pair", {
  keyName: `ec2-key-${getStack()}`,
  publicKey,
});

const instance = new aws.ec2.Instance("ec2-instance", {
  ami: ec2Image.then(ami => ami.id),
  instanceType: aws.ec2.InstanceType.T2_Micro,
  vpcSecurityGroupIds: [allowSSH.id],
  keyName: keyPair.keyName,
  userData,
  tags: {
    App: "onboarding-cloudguard",
  }
});

export const command = instance.publicDns.apply(dns => `ssh -i ${privateKeyPath} ubuntu@${dns}`);
