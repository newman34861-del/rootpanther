import type { SessionRecord } from "@rootpanther/ui";
import { sessionHistory } from "./account";
import { daysAgo } from "./time";

export const openvpn = {
  interfaceName: "tun0",
  endpoint: "lab-uks.rootpanther.net:1194",
  tunnelAddress: "10.13.37.201/32",
  gateway: "10.13.37.1",
  fileName: "rootpanther-lab.ovpn",
  issuedAt: daysAgo(19, 18),
  config: [
    "client",
    "dev tun",
    "proto udp",
    "remote lab-uks.rootpanther.net 1194",
    "resolv-retry infinite",
    "nobind",
    "persist-key",
    "persist-tun",
    "remote-cert-tls server",
    "auth SHA256",
    "cipher AES-256-GCM",
    "tls-version-min 1.2",
    "verb 3",
    "",
    "<ca>",
    "-----BEGIN CERTIFICATE-----",
    "MIIDQTCCAimgAwIBAgIUREPLACEWITHISSUEDLABAUTHORITYCERTb2690b1f0a",
    "-----END CERTIFICATE-----",
    "</ca>",
    "<cert>",
    "-----BEGIN CERTIFICATE-----",
    "MIIDSjCCAjKgAwIBAgIRAPLACEHOLDERPERUSERCLIENTCERT8a71c4e2d9f3c1",
    "-----END CERTIFICATE-----",
    "</cert>",
    "<key>",
    "-----BEGIN PRIVATE KEY-----",
    "MIIEvQIBADANBgkqhkiG9w0BAQEFAREPLACEHOLDERPERUSERPRIVATEKEY4d2a",
    "-----END PRIVATE KEY-----",
    "</key>",
  ].join("\n"),
};

export const keptOnAccount = {
  proofs: 2,
  notes: 14,
  reportId: "rep-meridian",
  reportSections: "3 of 9 sections drafted",
};

export const sessionLimits = {
  extendOptions: [30, 60],
  maxTotalMin: 480,
  idleWarnMin: 25,
};

export const suggestedResume = {
  scenarioId: "tamarack",
  lastSessionId: "ses_3Jq7Wn",
  note: "Foothold on TMK-01 as svc_monitor. SeImpersonatePrivilege not yet abused.",
};

export const supportEmail = "support@rootpanther.com";

export const allSessions: SessionRecord[] = [...sessionHistory].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
