import json
import logging
import re
import asyncio
import time
import paho.mqtt.client as mqtt
from app.core.config import settings
from datetime import datetime, timezone
from app.mqtt import topics, handlers

logger = logging.getLogger(__name__)

# Topic Regex Patterns for Routing
RE_SOIL = re.compile(r"krishisarth/zone/([^/]+)/soil")
RE_AMBIENT = re.compile(r"krishisarth/zone/([^/]+)/ambient")
RE_PUMP_TEL = re.compile(r"krishisarth/zone/([^/]+)/pump/telemetry")

class MQTTClient:
    """
    Refactored MQTT Manager for Cloud-Native Connectivity (HiveMQ).
    - Captures FastAPI event loop for thread-safe async callbacks.
    - Implements TLS/SSL and SASL authentication.
    - Robust reconnect logic for production stability.
    """
    def __init__(self):
        self.client = mqtt.Client(client_id="krishisarth_backend_service")
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        self.loop = None # To be set by set_loop during app startup
        
    def set_loop(self, loop):
        """Bind the running FastAPI event loop to this manager."""
        self.loop = loop

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info(">>> [MQTT] HiveMQ Cloud Connected Successfully")
            client.subscribe(topics.WILDCARD)
        else:
            logger.error(f">>> [MQTT] Connection Failed with code {rc}")

    def on_disconnect(self, client, userdata, rc):
        logger.warning(f">>> [MQTT] Disconnected from broker (code {rc}).")
        
    def on_message(self, client, userdata, msg):
        """Thread-safe dispatch to async handlers using the captured loop."""
        if not self.loop:
            logger.error(">>> [MQTT] Event loop not set; dropping message")
            return

        payload_str = msg.payload.decode()
        try:
            payload = json.loads(payload_str)
            topic = msg.topic
            
            # Helper to schedule async tasks safely from the MQTT background thread
            def schedule_coro(coro):
                asyncio.run_coroutine_threadsafe(coro, self.loop)

            # Route 1: Soil Readings
            match_soil = RE_SOIL.match(topic)
            if match_soil:
                schedule_coro(handlers.handle_soil_reading(match_soil.group(1), payload))
                return

            # Route 2: Ambient Readings
            match_ambient = RE_AMBIENT.match(topic)
            if match_ambient:
                schedule_coro(handlers.handle_ambient_reading(match_ambient.group(1), payload))
                return

            # Route 3: Pump Telemetry
            match_pump = RE_PUMP_TEL.match(topic)
            if match_pump:
                schedule_coro(handlers.handle_pump_telemetry(match_pump.group(1), payload))
                return

        except Exception as e:
            self._send_to_dlq(msg.topic, payload_str, str(e))

    def _send_to_dlq(self, topic: str, payload: str, error: str):
        from app.db.redis import redis_client
        logger.error(f"MQTT Error on {topic}: {error}")
        try:
            dlq_item = {
                "topic": topic, "payload": payload, "error": error,
                "at": datetime.now(timezone.utc).isoformat()
            }
            redis_client.rpush("mqtt_dlq", json.dumps(dlq_item))
        except Exception:
            logger.critical("MQTT DLQ CRITICAL FAILURE")

    def start(self):
        """Start persistent cloud connection with TLS and Auth."""
        # 1. Authentication
        if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
            self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

        # 2. TLS/SSL Setup (HiveMQ Cloud requirement)
        if settings.MQTT_USE_TLS or settings.MQTT_BROKER_PORT == 8883:
            self.client.tls_set() # Standard CA certs loaded automatically on most systems

        # 3. Connect with Retry Logic
        retries = 0
        max_retries = 10
        while retries < max_retries:
            try:
                logger.info(f"Connecting to MQTT Broker: {settings.MQTT_BROKER_HOST}...")
                self.client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, 60)
                break
            except Exception as e:
                retries += 1
                logger.error(f"MQTT Connect Fail ({retries}/{max_retries}): {e}")
                if retries >= max_retries: return
                time.sleep(5)

        self.client.loop_start() # Use loop_start() to allow main thread to continue
        logger.info("MQTT Background Loop Started")

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()

# Global manager instance
mqtt_manager = MQTTClient()
