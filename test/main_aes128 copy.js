import { Client } from "k6/x/mqtt";
import crypto from "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js";
import { sleep } from "k6";
import { Trend } from "k6/metrics";

// 1. Define Custom Metrics for Research Comparison
const encTimeTrend = new Trend("encryption_time_us"); // Execution Time (µs)
const delayTrend = new Trend("processing_delay_ms"); // Total Delay (ms)
const cyclesTrend = new Trend("cpu_cycles_est"); // Calculated Cycles

export const options = {
  scenarios: {
    my_mqtt_test: {
      executor: "per-vu-iterations",
      vus: 1000,
      iterations: 1,
      maxDuration: "1m",
    },
  },
};

// Machine specific: Set your PC's CPU Speed in GHz (Example: 3.5 GHz)
const CPU_FREQ_GHZ = 0.08;
const key = crypto.enc.Hex.parse("000102030405060708090A0B0C0D0E0F");

export default function () {
  const client = new Client();
  sleep(Math.random() * 10);

  client.on("connect", () => {
    const intervalId = setInterval(() => {
      // --- Start Metric 2: Total Processing Delay ---
      const delayStart = Date.now();

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

      // --- Start Metric 1: Execution Time ---
      const encStart = Date.now();

      const encrypted = crypto.AES.encrypt(dataWord, key, {
        mode: crypto.mode.ECB,
        padding: crypto.pad.Pkcs7,
      });
      const payload = encrypted.ciphertext
        .toString(crypto.enc.Hex)
        .toUpperCase();

      const encEnd = Date.now();
      const delayEnd = Date.now();
      // --- End Metrics ---

      // 2. Calculate and Record Values
      const execTimeMs = encEnd - encStart;
      const execTimeUs = execTimeMs * 1000; // Convert to microseconds (µs)
      const procDelayMs = delayEnd - delayStart;

      // Metric 3: Estimate CPU Cycles (Time * Frequency)
      // Reference: NodeMCU uses freq to calculate cycles.
      const estimatedCycles = execTimeMs * (CPU_FREQ_GHZ * 1000000);

      encTimeTrend.add(execTimeUs);
      delayTrend.add(procDelayMs);
      cyclesTrend.add(estimatedCycles);

      client.publish("sensors/data", payload);
    }, 50);

    setTimeout(() => {
      clearInterval(intervalId);
      client.end();
    }, 30000);
  });

  client.connect("mqtt://localhost:1883");
  sleep(35);
}
