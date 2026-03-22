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
    # DHT22 Profile: Temperature and Humidity
    reading = {
        "device_id": f"DHT22_{sensor_id}",
        "temperature": round(20.0 + random.random() * 15, 2),
        "humidity": round(40.0 + random.random() * 30, 2)
    }
    return json.dumps(reading).encode('utf-8')

scenarios = [20, 50, 100, 250, 500, 1000, 2000, 3000, 4000, 5000]
test_reads = 10000
current_version = 1

print(f"Starting Upfront Dictionary Evaluation on {test_reads} Continuous Reads...\n")

for count in scenarios:
    print("==================================================")
    print(f"--- Scenario: Upfront Training on {count} Samples ---")
    
    training_buffer = []
    for i in range(1, count + 1):
        training_buffer.append(generate_single(i))
        
    trained_dict = zstd.train_dictionary(32768, training_buffer)
    dict_bytes = trained_dict.as_bytes()
    
    version_byte = current_version % 256
    dict_payload = bytes([version_byte]) + dict_bytes
    dict_transfer_cost = len(dict_payload)
    
    client.publish("sensors/dictionary", dict_payload)
    print(f"[*] Synced Dictionary v{version_byte} ({dict_transfer_cost} bytes)")
    time.sleep(1)
    
    print(f"[*] Compressing and transmitting {test_reads} reads...")
    cctx = zstd.ZstdCompressor(dict_data=trained_dict)
    
    total_orig = 0
    total_comp = 0
    start_time = time.time()
    
    for i in range(1, test_reads + 1):
        raw_data = generate_single(i)
        comp_data = cctx.compress(raw_data)
        
        payload = bytes([version_byte]) + comp_data
        client.publish("sensors/data", payload)
        
        total_orig += len(raw_data)
        total_comp += len(comp_data)
        
    end_time = time.time()
    
    dcr = ((total_orig - total_comp) / total_orig) * 100
    total_time_ms = (end_time - start_time) * 1000
    throughput = total_comp / total_time_ms if total_time_ms > 0 else 0
    
    gross_saved = total_orig - total_comp
    net_saved = gross_saved - dict_transfer_cost
    
    print(f"[+] Final Result for {count}-Sample Dictionary:")
    print(f"    Total Original Data:       {total_orig} B")
    print(f"    Total Compressed Data:     {total_comp} B")
    print(f"    Dictionary Transfer Cost:  {dict_transfer_cost} B")
    print(f"    Gross Bandwidth Saved:     {gross_saved} B")
    print(f"    Net Bandwidth Saved:       {net_saved} B")
    print(f"    Average Stable DCR:        {dcr:.2f}%")
    print(f"    Transmission Time:         {total_time_ms:.2f} ms")
    print(f"    Throughput:                {throughput:.2f} B/ms\n")
    
    current_version += 1
    time.sleep(2)

client.loop_stop()
client.disconnect()