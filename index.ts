import { getStack, Config } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { readFileSync } from "fs";

const publicKeyPath = new Config().require("publicKeyPath");
const publicKey = readFileSync(publicKeyPath, "utf-8");

const amazonLinuxAmi = aws.ec2.getAmi({
  mostRecent: true,
  owners: ["amazon"],
  filters: [{
    name: "name",
    values: ["amzn-ami-hvm-*-x86_64-ebs"],
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
  keyName: `k3s-instance-key-${getStack()}`,
  publicKey,
});

const instance = new aws.ec2.Instance("k3s-instance", {
  ami: amazonLinuxAmi.then(ami => ami.id),
  instanceType: aws.ec2.InstanceType.T2_Micro,
  vpcSecurityGroupIds: [allowSSH.id],
  keyName: keyPair.keyName,
  tags: {
    App: "onboarding-cloudguard",
  }
});


export const dns = instance.publicDns;
export const privateKeyPath = publicKeyPath.slice(0, -1 * ".pub".length); 
export const command = instance.publicDns.apply(dns => `ssh -i ${privateKeyPath} ec2-user@${dns}`); 
