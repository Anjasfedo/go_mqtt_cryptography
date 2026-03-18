import { Client } from "k6/x/mqtt";
import { sleep } from "k6";

export const options = {
  scenarios: {
    my_mqtt_test: {
      executor: "per-vu-iterations",
      vus: 1000,
      iterations: 1, // Each VU runs the loop once then exits
      maxDuration: "1m", // Safety timeout
    },
  },
};

// --- Encryption Configuration ---
const key = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
];
const nonce = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// --- ChaCha20 Helper Functions ---
function rotl(v, c) {
  return (v << c) | (v >>> (32 - c));
}

function qr(x, a, b, c, d) {
  x[a] = (x[a] + x[b]) | 0;
  x[d] ^= x[a];
  x[d] = rotl(x[d], 16);
  x[c] = (x[c] + x[d]) | 0;
  x[b] ^= x[c];
  x[b] = rotl(x[b], 12);
  x[a] = (x[a] + x[b]) | 0;
  x[d] ^= x[a];
  x[d] = rotl(x[d], 8);
  x[c] = (x[c] + x[d]) | 0;
  x[b] ^= x[c];
  x[b] = rotl(x[b], 7);
}

function chacha20_encrypt(plaintext, key, nonce) {
  let k = [];
  for (let i = 0; i < 8; i++)
    k.push(
      key[i * 4] |
        (key[i * 4 + 1] << 8) |
        (key[i * 4 + 2] << 16) |
        (key[i * 4 + 3] << 24),
    );
  let n = [];
  for (let i = 0; i < 3; i++)
    n.push(
      nonce[i * 4] |
        (nonce[i * 4 + 1] << 8) |
        (nonce[i * 4 + 2] << 16) |
        (nonce[i * 4 + 3] << 24),
    );

  let s = [
    0x61707865,
    0x3320646e,
    0x79622d32,
    0x6b206574,
    k[0],
    k[1],
    k[2],
    k[3],
    k[4],
    k[5],
    k[6],
    k[7],
    0,
    n[0],
    n[1],
    n[2],
  ];
  let w = s.slice();
  for (let i = 0; i < 10; i++) {
    qr(w, 0, 4, 8, 12);
    qr(w, 1, 5, 9, 13);
    qr(w, 2, 6, 10, 14);
    qr(w, 3, 7, 11, 15);
    qr(w, 0, 5, 10, 15);
    qr(w, 1, 6, 11, 12);
    qr(w, 2, 7, 8, 13);
    qr(w, 3, 4, 9, 14);
  }
  for (let i = 0; i < 16; i++) s[i] = (s[i] + w[i]) | 0;

  let res = new Uint8Array(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) {
    res[i] = plaintext[i] ^ (s[i >> 2] >>> ((i & 3) << 3));
  }
  return res;
}

// --- Main Test Loop ---
export default function () {
  const client = new Client();
  let isClosing = false; // Safety gate to prevent panics

  // Stagger connections over 10s to prevent local port exhaustion
  sleep(Math.random() * 10);

  client.on("connect", () => {
    // 1. Start the publishing loop (20 msg/sec per VU)
    const intervalId = setInterval(() => {
      if (isClosing) return;

      const temp = 20.0 + Math.random() * 10.0;
      const hum = 40.0 + Math.random() * 20.0;

      const buf = new ArrayBuffer(8);
      const v = new DataView(buf);
      v.setFloat32(0, temp, true);
      v.setFloat32(4, hum, true);
      const plain = new Uint8Array(buf);

      // Manual ChaCha20 encryption
      const encryptedBytes = chacha20_encrypt(plain, key, nonce);

      let hex = "";
      for (let i = 0; i < encryptedBytes.length; i++) {
        hex += encryptedBytes[i].toString(16).padStart(2, "0");
      }

      try {
        client.publish("sensors/data", hex.toUpperCase());
      } catch (e) {
        // Suppress errors if publish triggers during client teardown
      }
    }, 50);

    // 2. Schedule graceful shutdown after 30 seconds
    setTimeout(() => {
      isClosing = true;
      clearInterval(intervalId);

      // Delay slightly to ensure in-flight packets clear before end()
      setTimeout(() => {
        client.end();
      }, 500);
    }, 30000);
  });

  client.on("error", (err) => {
    // Suppress console spam during high-load shutdowns
  });

  client.connect("mqtt://localhost:1883");

  // 3. Keep the VU script alive while the async events above process
  sleep(35);
}
