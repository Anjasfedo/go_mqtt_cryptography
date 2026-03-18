import { Client } from "k6/x/mqtt";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 500 }, // Ramp up to 500 VUs
    { duration: "20s", target: 1000 }, // Ramp up to 1000 VUs
    { duration: "10s", target: 0 }, // Graceful ramp down
  ],
};

const key = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
];

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

function chacha20_block(key, nonce, counter) {
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
    counter,
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
  let res = new Uint8Array(64);
  for (let i = 0; i < 16; i++) {
    let val = (s[i] + w[i]) | 0;
    res[i * 4] = val & 0xff;
    res[i * 4 + 1] = (val >>> 8) & 0xff;
    res[i * 4 + 2] = (val >>> 16) & 0xff;
    res[i * 4 + 3] = (val >>> 24) & 0xff;
  }
  return res;
}

function poly1305_mac(msg, polyKey) {
  let r_bytes = polyKey.slice(0, 16);
  let s_bytes = polyKey.slice(16, 32);
  r_bytes[3] &= 15;
  r_bytes[7] &= 15;
  r_bytes[11] &= 15;
  r_bytes[15] &= 15;
  r_bytes[4] &= 252;
  r_bytes[8] &= 252;
  r_bytes[12] &= 252;
  let r = BigInt(0);
  for (let i = 0; i < 16; i++) r |= BigInt(r_bytes[i]) << BigInt(i * 8);
  let s = BigInt(0);
  for (let i = 0; i < 16; i++) s |= BigInt(s_bytes[i]) << BigInt(i * 8);
  let p = (1n << 130n) - 5n;
  let h = 0n;
  for (let i = 0; i < msg.length; i += 16) {
    let m = 0n;
    let chunk = msg.slice(i, i + 16);
    for (let j = 0; j < chunk.length; j++)
      m |= BigInt(chunk[j]) << BigInt(j * 8);
    m |= 1n << BigInt(chunk.length * 8);
    h = ((h + m) * r) % p;
  }
  h = (h + s) % (1n << 128n);
  let tag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) tag[i] = Number((h >> BigInt(i * 8)) & 0xffn);
  return tag;
}

export default function () {
  const client = new Client();
  sleep(Math.random() * 2);
  client.connect("mqtt://localhost:1883");

  const startTime = Date.now();
  const testDuration = 30000;

  while (Date.now() - startTime < testDuration) {
    const nonce = new Uint8Array(12);
    for (let i = 0; i < 12; i++) nonce[i] = Math.floor(Math.random() * 256);

    const temp = 20.0 + Math.random() * 10.0;
    const hum = 40.0 + Math.random() * 20.0;
    const buf = new ArrayBuffer(8);
    const v = new DataView(buf);
    v.setFloat32(0, temp, true);
    v.setFloat32(4, hum, true);
    const plain = new Uint8Array(buf);

    const polyKey = chacha20_block(key, nonce, 0).slice(0, 32);
    const keyStream1 = chacha20_block(key, nonce, 1);

    const encrypted = new Uint8Array(8);
    for (let i = 0; i < 8; i++) encrypted[i] = plain[i] ^ keyStream1[i];

    const macData = new Uint8Array(32);
    macData.set(encrypted, 0);
    let dv = new DataView(macData.buffer);
    dv.setBigUint64(16, 0n, true);
    dv.setBigUint64(24, 8n, true);

    const tag = poly1305_mac(macData, polyKey);
    const finalPayload = new Uint8Array(12 + 8 + 16);
    finalPayload.set(nonce, 0);
    finalPayload.set(encrypted, 12);
    finalPayload.set(tag, 20);

    let hexStr = "";
    for (let i = 0; i < finalPayload.length; i++) {
      hexStr += finalPayload[i].toString(16).padStart(2, "0");
    }

    console.log(hexStr.toUpperCase());
    client.publish("sensors/data", hexStr.toUpperCase());
    sleep(0.01);
  }

  // Explicit clean disconnect
  client.end();
}
