import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'pp_pin_v1';

async function setItem(k: string, v: string) {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(k, v);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(k, v);
}
async function getItem(k: string) {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(k);
}
async function delItem(k: string) {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(k);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(k);
}

async function hash(pin: string, salt: string) {
  // Iterated SHA-256 with a per-device salt; the PIN itself is never stored.
  let h = `${salt}:${pin}`;
  for (let i = 0; i < 2000; i++) h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h);
  return h;
}

export async function setPin(pin: string) {
  const salt = Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  await setItem(PIN_KEY, JSON.stringify({ salt, hash: await hash(pin, salt) }));
}

export async function checkPin(pin: string): Promise<boolean> {
  const raw = await getItem(PIN_KEY);
  if (!raw) return false;
  const { salt, hash: h } = JSON.parse(raw) as { salt: string; hash: string };
  return (await hash(pin, salt)) === h;
}

export async function hasPin() {
  return !!(await getItem(PIN_KEY));
}

export async function clearPin() {
  await delItem(PIN_KEY);
}

export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricUnlock(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Petal & Pulse', fallbackLabel: 'Use PIN', disableDeviceFallback: false });
    return r.success;
  } catch {
    return false;
  }
}
