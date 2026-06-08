import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

function encodeHash(salt: Buffer, derivedKey: Buffer) {
  return `${HASH_PREFIX}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return encodeHash(salt, derivedKey);
}

export async function verifyPassword(password: string, storedHash: string) {
  if (!storedHash.startsWith(`${HASH_PREFIX}$`)) {
    return {
      valid: password === storedHash,
      needsRehash: true,
    };
  }

  const [, saltHex, keyHex] = storedHash.split("$");
  if (!saltHex || !keyHex) {
    return {
      valid: false,
      needsRehash: false,
    };
  }

  const salt = Buffer.from(saltHex, "hex");
  const storedKey = Buffer.from(keyHex, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  if (storedKey.length !== derivedKey.length) {
    return {
      valid: false,
      needsRehash: false,
    };
  }

  return {
    valid: timingSafeEqual(storedKey, derivedKey),
    needsRehash: false,
  };
}
