import json
import random
import time
import paho.mqtt.client as mqtt
import zstandard as zstd

broker_address = "localhost"
port = 1883

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect(broker_address, port, 60)
client.loop_start()

time.sleep(1)

def generate_single(sensor_id):
    # SCHEMA SHIFT at 500: Simulates a sensor firmware update adding new metrics and changing keys
    reading = {
            "sensor_id": f"S{sensor_id}",
            "temp": round(36.0 + random.random(), 2),
            "heart_rate": int(60 + random.random() * 40),
            "oxygen": int(95 + random.random() * 5)
        }
    return json.dumps(reading).encode('utf-8')

EVAL_WINDOW = 500 
IMPROVEMENT_THRESHOLD = 5.0 # Update if the new dictionary improves DCR by at least 2%

active_dict = None
current_version = 1
buffer = []

print("Starting Adaptive Dictionary Optimization...")

for i in range(1, 10001):
    raw_data = generate_single(i)
    orig_size = len(raw_data)
    buffer.append(raw_data)

    # 1. Transmit Data
    if active_dict is None:
        client.publish("sensors/raw", raw_data)
        print(f"Read {i} (Raw) | Size: {orig_size} B")
    else:
        cctx = zstd.ZstdCompressor(dict_data=active_dict)
        comp_data = cctx.compress(raw_data)
        comp_size = len(comp_data)
        payload = bytes([current_version - 1]) + comp_data
        
        client.publish("sensors/data", payload)
        
        dcr = ((orig_size - comp_size) / orig_size) * 100
        print(f"Read {i} (Dict v{current_version-1}) | Orig: {orig_size} B | Comp: {comp_size} B | DCR: {dcr:.2f}%")

    # 2. Periodic Shadow Evaluation
    if i % EVAL_WINDOW == 0:
        print(f"\n--- Evaluating Dictionary Optimization at Read {i} ---")
        
        if active_dict is None:
            # Bootstrap the first dictionary
            trained_dict = zstd.train_dictionary(32768, buffer)
            dict_bytes = trained_dict.as_bytes()
            dict_payload = bytes([current_version]) + dict_bytes
            client.publish("sensors/dictionary", dict_payload)
            active_dict = trained_dict
            print(f"[*] Initialized Base Dictionary v{current_version} ({len(dict_bytes)} bytes)\n")
            current_version += 1
        else:
            # Train a shadow dictionary and test it against the active one
            shadow_dict = zstd.train_dictionary(32768, buffer)
            
            active_cctx = zstd.ZstdCompressor(dict_data=active_dict)
            shadow_cctx = zstd.ZstdCompressor(dict_data=shadow_dict)
            
            # Simulate compressing the recent buffer with both
            active_comp_size = sum(len(active_cctx.compress(item)) for item in buffer)
            shadow_comp_size = sum(len(shadow_cctx.compress(item)) for item in buffer)
            total_orig = sum(len(item) for item in buffer)
            
            active_dcr = ((total_orig - active_comp_size) / total_orig) * 100
            shadow_dcr = ((total_orig - shadow_comp_size) / total_orig) * 100
            
            improvement = shadow_dcr - active_dcr
            
            print(f"Active Dict DCR: {active_dcr:.2f}% | Shadow Dict DCR: {shadow_dcr:.2f}% | Improvement: {improvement:.2f}%")
            
            # Optimization Logic: Only update if it actually helps!
            if improvement >= IMPROVEMENT_THRESHOLD:
                dict_bytes = shadow_dict.as_bytes()
                dict_payload = bytes([current_version]) + dict_bytes
                client.publish("sensors/dictionary", dict_payload)
                active_dict = shadow_dict
                print(f"[+] Optimization Triggered! Synced Dictionary v{current_version} ({len(dict_bytes)} bytes)\n")
                current_version += 1
            else:
                print(f"[-] Optimization skipped. Improvement did not meet threshold. Conserving network bandwidth.\n")
        
        buffer = []
        time.sleep(1)
    else:
        time.sleep(0.01)

client.loop_stop()
client.disconnect()