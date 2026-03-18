import { Client } from "k6/x/mqtt";
import crypto from "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js";

export const options = {
  vus: 100,
  duration: "30s",
};

const key = crypto.enc.Hex.parse("000102030405060708090A0B0C0D0E0F");

export default function () {
  const client = new Client();

  client.on("connect", () => {
    // 1. Start the publishing loop
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
    }, 10);

    // 2. Schedule a graceful shutdown at 29.5 seconds
    setTimeout(() => {
      clearInterval(intervalId); // Stop publishing
      client.end(); // Send MQTT DISCONNECT and close the socket
    }, 29500);
  });

  client.on("error", (err) => {
    console.error("MQTT Error:", err);
  });

  client.connect("mqtt://localhost:1883");
}
