const CERT_NO_PATTERNS = [
  /^\d{4}-\d{1,2}-\d+$/,
  /^\d{4}\.\d{1,2}\.\d+$/,
  /^\d{4}\/\d{1,2}\/\d+$/,
  /^\d{4}[-./]특[-./]?\d+$/,
];
const SPECIAL_CERT_PATTERN = /^(\d{4})-특-?(\d+)$/;

const CERT_KEYWORDS = [
  "필증",
  "권리증",
  "증서",
  "증번호",
  "채권번호",
  "certificate",
  "cert_no",
  "certno",
];

export function normalizeCertificateNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (["nan", "none", "null", "-", "없음"].includes(lowered)) return null;

  const compact = raw.replace(/\s+/g, "");
  for (const pattern of CERT_NO_PATTERNS) {
    if (pattern.test(compact)) {
      const normalized = compact.replace(/[./]/g, "-");
      const specialMatch = normalized.match(SPECIAL_CERT_PATTERN);
      if (specialMatch) {
        return `${specialMatch[1]}-특-${specialMatch[2]}`;
      }
      return normalized;
    }
  }

  return null;
}

function isCertificateKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return CERT_KEYWORDS.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

function collectFromUnknown(
  node: unknown,
  certSet: Set<string>,
  parentKey = "",
): void {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectFromUnknown(item, certSet, parentKey);
    }
    return;
  }

  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (isCertificateKey(key) || isCertificateKey(parentKey)) {
        const normalized = normalizeCertificateNumber(value);
        if (normalized) certSet.add(normalized);
      }
      collectFromUnknown(value, certSet, key);
    }
    return;
  }

  if (isCertificateKey(parentKey)) {
    const normalized = normalizeCertificateNumber(node);
    if (normalized) certSet.add(normalized);
  }
}

function collectFromCertificates(certificates: unknown, certSet: Set<string>): void {
  if (!Array.isArray(certificates)) return;

  for (const certificate of certificates) {
    if (!certificate || typeof certificate !== "object") continue;

    const certObj = certificate as Record<string, unknown>;
    for (const [key, value] of Object.entries(certObj)) {
      if (!isCertificateKey(key) && key !== "no" && key !== "number") continue;
      const normalized = normalizeCertificateNumber(value);
      if (normalized) certSet.add(normalized);
    }
  }
}

export function extractCertificateNumbers(
  rawData: unknown,
  certificates?: unknown,
): string[] {
  const certSet = new Set<string>();
  collectFromCertificates(certificates, certSet);
  collectFromUnknown(rawData, certSet);
  return [...certSet];
}

export function countRightsByCertificateNumber(
  rawData: unknown,
  certificates?: unknown,
): number {
  return extractCertificateNumbers(rawData, certificates).length;
}
