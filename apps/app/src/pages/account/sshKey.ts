export type SshKeyType = "ssh-ed25519" | "sk-ssh-ed25519@openssh.com" | "ecdsa-sha2-nistp256" | "ecdsa-sha2-nistp384" | "ecdsa-sha2-nistp521" | "ssh-rsa";

const LABEL: Record<SshKeyType, string> = {
  "ssh-ed25519": "ED25519",
  "sk-ssh-ed25519@openssh.com": "ED25519-SK",
  "ecdsa-sha2-nistp256": "ECDSA 256",
  "ecdsa-sha2-nistp384": "ECDSA 384",
  "ecdsa-sha2-nistp521": "ECDSA 521",
  "ssh-rsa": "RSA",
};

export type SshKeyResult =
  | { ok: true; type: SshKeyType; label: string; bits?: number; comment: string; blob: Uint8Array }
  | { ok: false; error: string };

function readUint32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function readField(b: Uint8Array, o: number): { data: Uint8Array; next: number } | null {
  if (o + 4 > b.length) return null;
  const len = readUint32(b, o);
  if (o + 4 + len > b.length) return null;
  return { data: b.subarray(o + 4, o + 4 + len), next: o + 4 + len };
}

function rsaBits(blob: Uint8Array): number | undefined {
  const t = readField(blob, 0);
  const e = t && readField(blob, t.next);
  const n = e && readField(blob, e.next);
  if (!n) return undefined;
  let i = 0;
  while (i < n.data.length && n.data[i] === 0) i++;
  if (i === n.data.length) return undefined;
  return (n.data.length - i - 1) * 8 + (32 - Math.clz32(n.data[i]));
}

export function parseSshKey(raw: string): SshKeyResult {
  const text = raw.trim();
  if (/PRIVATE KEY/.test(text)) return { ok: false, error: "This is a private key. Paste the .pub file instead, and keep the private key on your machine." };
  if (text.includes("\n")) return { ok: false, error: "Paste a single key on one line." };
  const [type, data, ...rest] = text.split(/\s+/);
  if (!(type in LABEL)) return { ok: false, error: "Not an OpenSSH public key. It should start with ssh-ed25519, ecdsa-sha2 or ssh-rsa." };
  if (!data) return { ok: false, error: "The key data after the key type is missing." };
  let blob: Uint8Array;
  try {
    blob = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, error: "The key data is not valid base64. Copy the whole line from the .pub file." };
  }
  const head = readField(blob, 0);
  if (!head || new TextDecoder().decode(head.data) !== type) return { ok: false, error: "The key data does not match its type. The key may be truncated." };
  const kt = type as SshKeyType;
  const bits = kt === "ssh-rsa" ? rsaBits(blob) : undefined;
  if (kt === "ssh-rsa" && (bits ?? 0) < 3072) return { ok: false, error: `RSA keys need at least 3072 bits. This one has ${bits ?? "an unknown number of"} bits. Use ED25519 instead.` };
  return { ok: true, type: kt, label: LABEL[kt], bits, comment: rest.join(" "), blob };
}

export async function sshFingerprint(blob: Uint8Array): Promise<string | null> {
  if (!window.crypto?.subtle) return null;
  const digest = await window.crypto.subtle.digest("SHA-256", new Uint8Array(blob));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `SHA256:${b64.replace(/=+$/, "")}`;
}
