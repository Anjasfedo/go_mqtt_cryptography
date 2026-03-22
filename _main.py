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

def generate_batch(count):
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

print("Executing Comparative Evaluation with Baseline Table 4\n")

for count in scenarios:
    print("==================================================")
    print(f"--- Scenario: {count} IoT Sensor Reads ---")
    
    training_samples = []
    for _ in range(20):
        training_samples.append(generate_batch(count))
        
    trained_dict = zstd.train_dictionary(32768, training_samples)
    dict_bytes = trained_dict.as_bytes()
    
    version_byte = current_version % 256
    dict_payload = bytes([version_byte]) + dict_bytes
    client.publish("sensors/dictionary", dict_payload)
    time.sleep(1)
    
    cctx = zstd.ZstdCompressor(dict_data=trained_dict)
    raw_data = generate_batch(count)
    comp_data = cctx.compress(raw_data)
    
    orig_size = len(raw_data)
    comp_size = len(comp_data)
    dcr = ((orig_size - comp_size) / orig_size) * 100
    
    print(f"Size of Original Data:    {orig_size} B")
    print(f"Size of Compressed Data:  {comp_size} B")
    print(f"Proposed System DCR:      {dcr:.2f}%\n")
    
    current_version += 1
    time.sleep(2)

client.loop_stop()
client.disconnect()