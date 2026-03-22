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
    reading = {
        "sensor_id": f"S{sensor_id}",
        "temp": round(36.0 + random.random(), 2),
        "heart_rate": int(60 + random.random() * 40),
        "oxygen": int(95 + random.random() * 5)
    }
    return json.dumps(reading).encode('utf-8')

scenarios = [20, 50, 100, 250, 500, 1000]
current_version = 1
trained_dict = None
training_buffer = []

total_orig = 0
total_comp = 0
window_start = 1

for i in range(1, 1001):
    raw_data = generate_single(i)
    orig_size = len(raw_data)
    training_buffer.append(raw_data)
    
    if trained_dict is None:
        client.publish("sensors/raw", raw_data)
        print(f"Read {i} (Raw) | Size: {orig_size} B")
    else:
        cctx = zstd.ZstdCompressor(dict_data=trained_dict)
        compressed_data = cctx.compress(raw_data)
        comp_size = len(compressed_data)
        
        payload = bytes([current_version - 1]) + compressed_data
        client.publish("sensors/data", payload)
        
        dcr = ((orig_size - comp_size) / orig_size) * 100
        print(f"Read {i} (Dict v{current_version-1}) | Orig: {orig_size} B | Comp: {comp_size} B | DCR: {dcr:.2f}%")
        
        total_orig += orig_size
        total_comp += comp_size

    if i in scenarios:
        print(f"\n--- Reached Boundary: {i} Reads ---")
        if trained_dict is not None:
            window_dcr = ((total_orig - total_comp) / total_orig) * 100
            print(f"Window Summary (Reads {window_start} to {i}) | Avg DCR: {window_dcr:.2f}%")
        
        trained_dict = zstd.train_dictionary(32768, training_buffer)
        dict_bytes = trained_dict.as_bytes()
        
        dict_payload = bytes([current_version]) + dict_bytes
        client.publish("sensors/dictionary", dict_payload)
        print(f"Synchronized Dictionary v{current_version} ({len(dict_bytes)} bytes)\n")
        
        current_version += 1
        training_buffer = []
        total_orig = 0
        total_comp = 0
        window_start = i + 1
        time.sleep(1)
    else:
        time.sleep(0.01)

client.loop_stop()
client.disconnect()