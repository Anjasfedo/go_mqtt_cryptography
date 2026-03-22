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

def generate_sample(count):
    readings = []
    for i in range(count):
        readings.append({
            "sensor_id": f"S{i+1}",
            "temp": round(36.0 + random.random(), 2),
            "heart_rate": int(60 + random.random() * 40),
            "oxygen": int(95 + random.random() * 5)
        })
    return json.dumps(readings).encode('utf-8')

scenarios = [20, 50, 100]
current_version = 1

for count in scenarios:
    print(f"\n--- Starting {count} Reads Scenario ---")
    
    samples = []
    for _ in range(10):
        samples.append(generate_sample(count))
        
    print("Training dictionary locally...")
    trained_dict = zstd.train_dictionary(8192, samples)
    dict_bytes = trained_dict.as_bytes()
    
    dict_payload = bytes([current_version]) + dict_bytes
    client.publish("sensors/dictionary", dict_payload)
    print(f"Published Dictionary v{current_version} ({len(dict_bytes)} bytes) to server.")
    
    time.sleep(1)
    
    cctx = zstd.ZstdCompressor(dict_data=trained_dict)
    new_data = generate_sample(count)
    compressed_data = cctx.compress(new_data)
    
    payload = bytes([current_version]) + compressed_data
    client.publish("sensors/data", payload)
    
    orig_size = len(new_data)
    comp_size = len(compressed_data)
    dcr = ((orig_size - comp_size) / orig_size) * 100
    print(f"Result: Original: {orig_size} B, Compressed: {comp_size} B, DCR: {dcr:.2f}%")
    
    current_version += 1
    time.sleep(2)

client.loop_stop()
client.disconnect()