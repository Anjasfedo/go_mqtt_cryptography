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

# def generate_sample(count):
#     readings = []
#     # Base timestamp to simulate real-time data sequence
#     current_time = time.time()
    
#     for i in range(count):
#         # Realistic healthcare ranges
#         temp = round(36.1 + random.uniform(-0.5, 0.5), 2)
#         hr = int(70 + random.uniform(-10, 20))
#         ox = int(96 + random.uniform(-2, 3))
        
#         # Introduce occasional anomalies (1% chance) to simulate "original" data variability
#         if random.random() < 0.01:
#             temp += 2.0  # Fever spike
#             hr += 30     # Tachycardia simulation
#             ox -= 5      # Hypoxia simulation

#         # Determine status based on readings
#         status = "normal"
#         if temp > 37.5 or hr > 100 or ox < 94:
#             status = "warning"
#         if temp > 39.0 or hr > 130 or ox < 90:
#             status = "critical"

#         readings.append({
#             "sensor_id": f"dev-node-{1000 + (i % 5)}", # Multiple readings per node
#             "timestamp": round(current_time + i, 3),   # Sequential timestamps
#             "data": {
#                 "temperature": {"value": temp, "unit": "Celsius"},
#                 "heart_rate": {"value": hr, "unit": "bpm"},
#                 "oxygen": {"value": ox, "unit": "percentage"}
#             },
#             "status": status,
#             "battery_level": round(random.uniform(15, 99), 1), # IoT device metadata
#             "accuracy_score": round(random.uniform(0.95, 0.99), 2)
#         })
        
#     return json.dumps(readings).encode('utf-8')

scenarios = [20, 50, 100, 250, 500, 1000]
current_version = 1

for count in scenarios:
    print(f"\n--- Starting {count} Reads Scenario ---")
    
    samples = []
    for _ in range(10):
        samples.append(generate_sample(count))
        
    print("Training dictionary locally...")
    trained_dict = zstd.train_dictionary(32768, samples)
    dict_bytes = trained_dict.as_bytes()
    
    dict_payload = bytes([current_version]) + dict_bytes
    client.publish("sensors/dictionary", dict_payload)
    print(f"Published Dictionary v{current_version} ({len(dict_bytes)} bytes) to server.")
    
    time.sleep(1)
    
    cctx = zstd.ZstdCompressor(dict_data=trained_dict)
    new_data = generate_sample(count)
    compressed_data = cctx.compress(new_data)
    
    payload = bytes([current_version]) + compressed_data
    
    start_time = time.time()
    
    msg_info = client.publish("sensors/data", payload)
    msg_info.wait_for_publish()
    
    end_time = time.time()
    
    transmission_time_ms = (end_time - start_time) * 1000
    
    throughput = 0
    if transmission_time_ms > 0:
        throughput = len(payload) / transmission_time_ms
        
    orig_size = len(new_data)
    comp_size = len(compressed_data)
    dcr = ((orig_size - comp_size) / orig_size) * 100
    
    print(f"Result: Original: {orig_size} B, Compressed: {comp_size} B, DCR: {dcr:.2f}%")
    print(f"Transmission Time: {transmission_time_ms:.2f} ms")
    print(f"Throughput: {throughput:.2f} Bytes/ms")
    
    current_version += 1
    time.sleep(2)

client.loop_stop()
client.disconnect()