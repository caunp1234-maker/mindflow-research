// 피험자 PII 컬럼(name, contactPhone, demographics, medicalHistory) 암호화.
// docs/privacy-and-hosting.md §3: "식별 가능 정보는 DB 컬럼 단위 암호화(at-rest)를 기본으로 한다."
//
// AES-256-GCM. 저장 형식: base64(iv[12] || authTag[16] || ciphertext).
// ENCRYPTION_KEY는 32바이트를 base64로 인코딩한 문자열이어야 한다(.env.example 참고).

const crypto = require('crypto');
const config = require('../config');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  const key = Buffer.from(config.encryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY는 32바이트(base64 인코딩)여야 합니다.');
  }
  return key;
}

/** 문자열을 암호화해 base64 문자열로 반환한다. null/undefined는 그대로 통과. */
function encryptField(plainText) {
  if (plainText === null || plainText === undefined) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** encryptField로 만든 base64 문자열을 원문 문자열로 복호화한다. */
function decryptField(encoded) {
  if (encoded === null || encoded === undefined) return null;
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/** demographics/medicalHistory처럼 객체를 암호화할 때 쓰는 헬퍼. */
function encryptJson(obj) {
  if (obj === null || obj === undefined) return null;
  return encryptField(JSON.stringify(obj));
}

function decryptJson(encoded) {
  const text = decryptField(encoded);
  return text === null ? null : JSON.parse(text);
}

module.exports = { encryptField, decryptField, encryptJson, decryptJson };
