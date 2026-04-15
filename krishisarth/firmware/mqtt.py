import time
import json
import random
import requests
import paho.mqtt.client as mqtt

# --- Configuration ---
# Update these URLs for your production Railway / Vercel endpoints
BACKEND_INGEST_URL = "https://your-backend.railway.app/v1/hardware/ingest"
MQTT_BROKER = "your-mqtt-broker.com"
MQTT_PORT = 1883
FARM_ID = "your-farm-uuid"  # Optional: logic for routing

def send_to_backend(data: dict):
    """
    Directly posts sensor telemetry to the KrishiSarth backend route.
    This triggers ML models, InfluxDB storage, and WebSocket broadcasts.
    """
    try:
        r = requests.post(
            BACKEND_INGEST_URL,
            json=data,
            timeout=5
        )
        print(f"[HTTP] Backend Response: {r.status_code}")
    except Exception as e:
        print(f"[HTTP] Backend Send Failed: {e}")

def on_connect(client, userdata, flags, rc):
    print(f"[MQTT] Connected with result code {rc}")
    # Subscribe to control topics for the zones managed by this Pi
    # e.g. krishisarth/zone/+/pump/on
    client.subscribe("krishisarth/zone/+/pump/on")
    client.subscribe("krishisarth/zone/+/fertigation/start")

def on_message(client, userdata, msg):
    print(f"[MQTT] Received command on {msg.topic}: {msg.payload.decode()}")
    # Here you would trigger real GPIO pins for relays / pumps
    # if "pump/on" in msg.topic:
    #     gpio.output(pump_pin, True)

# --- Main Simulation Loop ---
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

try:
    # client.connect(MQTT_BROKER, MQTT_PORT, 60)
    # client.loop_start()
    print("KrishiSarth Hardware Node Started.")
    
    zone_id_index = 1
    
    while True:
        # 1. Simulate Sensor Reading
        # moisture < 30 triggers auto-irrigation in View Mode on backend
        # N < 10 triggers auto-fertigation in View Mode on backend
        payload = {
            "id": zone_id_index,
            "temp": round(random.uniform(25.0, 35.0), 1),
            "hum": round(random.uniform(20.0, 60.0), 1),
            "soil": random.randint(10, 80),
            "N": random.randint(5, 50),
            "P": random.randint(5, 50),
            "K": random.randint(5, 50),
            
            # Optional supplemental fields for ML
            "ph": 6.5,
            "rainfall": 120.0,
            "ec": 0.5
        }
        
        print(f"\n[Hardware] Zone {zone_id_index} Readings: Soil {payload['soil']}% | NPK {payload['N']},{payload['P']},{payload['K']}")
        
        # 2. Publish via MQTT (Legacy compatibility)
        # client.publish(f"krishisarth/zone/{zone_id_index}/sensors", json.dumps(payload))
        
        # 3. Direct Ingest to Backend (New Digital Twin logic)
        send_to_backend(payload)
        
        time.sleep(10)  # Wait 10 seconds between heartbeats
        
except KeyboardInterrupt:
    print("Node Shutting Down.")
    # client.loop_stop()
