import { Client } from "k6/x/mqtt";
import crypto from "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js";
import { sleep } from "k6";

export const options = {
  scenarios: {
    my_mqtt_test: {
      executor: "per-vu-iterations",
      vus: 1000,
      iterations: 1, // Each VU runs exactly once
      maxDuration: "1m", // Safety timeout
    },
  },
};

// AES-128 Key: Exactly 16 bytes (32 hex characters)
const key = crypto.enc.Hex.parse("000102030405060708090A0B0C0D0E0F");

export default function () {
  const client = new Client();

  // STAGGER: Spreads the 1,000 connections over 5 seconds to avoid CPU spikes
  sleep(Math.random() * 10);

  client.on("connect", () => {
    const intervalId = setInterval(() => {
      const temp = 20.0 + Math.random() * 10.0;
      const hum = 40.0 + Math.random() * 20.0;

      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setFloat32(0, temp, true);
      view.setFloat32(4, hum, true);

      const arr = new Uint8Array(buffer);
      let hexStr = "";
      for (let i = 0; i < arr.length; i++) {
        hexStr += arr[i].toString(16).padStart(2, "0");
      }

      const dataWord = crypto.enc.Hex.parse(hexStr);

      // AES-128 Encryption
      const encrypted = crypto.AES.encrypt(dataWord, key, {
        mode: crypto.mode.ECB,
        padding: crypto.pad.Pkcs7,
      });

      const payload = encrypted.ciphertext
        .toString(crypto.enc.Hex)
        .toUpperCase();
      client.publish("sensors/data", payload);
    }, 50); // 20 messages per second per VU

    // Keep the loop running for the duration of the stages (10+20+10 = 40)
    setTimeout(() => {
      clearInterval(intervalId);
      client.end();
    }, 30000);
  });

  client.on("error", (err) => {
    // Suppress noise during high-concurrency shutdown
  });

  client.connect("mqtt://localhost:1883");

  // Keep the VU script alive while the async events above process
  sleep(35);
}
