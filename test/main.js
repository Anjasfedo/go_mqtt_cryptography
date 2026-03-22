import { Client } from "k6/x/mqtt";
import { sleep } from "k6";
import * as zstdify from "https://cdn.skypack.dev/zstdify?min";

export const options = {
  scenarios: {
    my_mqtt_test: {
      executor: "per-vu-iterations",
      vus: 100,
      iterations: 1,
      maxDuration: "1m",
    },
  },
};

function encodeUTF8(str) {
  let utf8 = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    }
  }
  return new Uint8Array(utf8);
}

export default function () {
  const client = new Client();

  sleep(Math.random() * 5);

  client.on("connect", () => {
    const intervalId = setInterval(() => {
      let readings = [];
      for (let i = 0; i < 100; i++) {
        readings.push({
          sensor_id: "S" + (i + 1),
          temp: 36.0 + Math.random(),
          heart_rate: Math.floor(60 + Math.random() * 40),
          oxygen: Math.floor(95 + Math.random() * 5),
        });
      }

      const jsonString = JSON.stringify(readings);
      const rawBytes = encodeUTF8(jsonString);

      const compressedData = zstdify.compress(rawBytes);

      let payloadBuffer = new ArrayBuffer(compressedData.length);
      let view = new Uint8Array(payloadBuffer);
      for (let i = 0; i < compressedData.length; i++) {
        view[i] = compressedData[i];
      }

      client.publish("sensors/data", payloadBuffer);
    }, 1000);

    setTimeout(() => {
      clearInterval(intervalId);
      client.end();
    }, 30000);
  });

  client.on("error", (err) => {});

  client.connect("mqtt://localhost:1883");

  sleep(35);
}
