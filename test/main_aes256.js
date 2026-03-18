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

const key = crypto.enc.Hex.parse(
  "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F",
);

export default function () {
  const client = new Client();

  // IMPORTANT: Stagger the start of 1,000 VUs so they don't crash your local CPU/Network
  // __VU is the ID of the current virtual user
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
      const encrypted = crypto.AES.encrypt(dataWord, key, {
        mode: crypto.mode.ECB,
        padding: crypto.pad.Pkcs7,
      });

      const payload = encrypted.ciphertext
        .toString(crypto.enc.Hex)
        .toUpperCase();
      client.publish("sensors/data", payload);
    }, 50); // Increased to 50ms to save CPU when running 1,000 VUs

    setTimeout(() => {
      clearInterval(intervalId);
      client.end();
    }, 30000); // Run for 30 seconds
  });

  client.on("error", (err) => {
    // Suppress common connection reset errors during high-load shutdowns
  });

  client.connect("mqtt://localhost:1883");

  // Keep the VU alive while the async logic above runs
  sleep(35);
}
