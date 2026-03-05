export function detectMaliciousInput(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  const patterns = [
    /ignore\s+(previous|all|any|the)\s+(instructions?|prompts?|rules?)/gi,
    /forget\s+(everything|all|previous|your)/gi,
    /disregard\s+(previous|all|any)\s+(instructions?|rules?)/gi,
    /you\s+are\s+(now|a|an)\s+(?!arya)/gi,
    /act\s+as\s+(a|an)\s+/gi,
    /pretend\s+(you|to)\s+(are|be)/gi,
    /behave\s+(like|as)/gi,
    /system\s+prompt/gi,
    /show\s+(me\s+)?(your|the)\s+(prompt|instructions|rules)/gi,
    /reveal\s+(your|the)\s+(prompt|instructions|system)/gi,
    /what\s+(is|are)\s+your\s+(instructions|rules|prompt)/gi,
    /role\s*:\s*system/gi,
    /role\s*:\s*assistant/gi,
    /\[system\]/gi,
    /\{system\}/gi,
    /execute\s+(command|code)/gi,
    /run\s+(command|code|script)/gi,
    /eval\s*\(/gi,
    /new\s+instructions?/gi,
    /override\s+(previous|all)/gi,
    /reset\s+(your|the)\s+(memory|instructions|context)/gi,
  ];

  return patterns.some(pattern => pattern.test(input));
}

export function sanitizeInput(input: string, maxLength: number = 200): string {
  if (!input || typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength).replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim();
}

export function isValidProductName(product: string): boolean {
  if (!product || typeof product !== 'string') return false;
  const trimmed = product.trim();
  // Allow letters, numbers, spaces, hyphens, underscores, Spanish chars, and common symbols
  const pattern = /^[a-zA-Z0-9\s\-_áéíóúñÁÉÍÓÚÑüÜ.,()]+$/;
  return pattern.test(trimmed) && trimmed.length >= 2 && trimmed.length <= 100;
}

export function hashIdentifier(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
