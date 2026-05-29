import json
from typing import Callable, Dict, List
import redis
from agent_service.config import settings

class EventBus:
    def __init__(self):
        self.redis_client = None
        self.local_handlers: Dict[str, List[Callable]] = {}
        self.use_redis = False
        
        # Try to connect to Redis
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD or None,
                socket_timeout=2.0
            )
            # Test ping
            self.redis_client.ping()
            self.use_redis = True
            print("EventBus successfully connected to Redis.")
        except Exception as e:
            print(f"Warning: Could not connect to Redis: {e}. Falling back to in-memory EventBus.")
            self.redis_client = None
            self.use_redis = False

    def publish(self, channel: str, message: Dict) -> bool:
        """Publishes an event message to a channel."""
        json_msg = json.dumps(message)
        if self.use_redis and self.redis_client:
            try:
                self.redis_client.publish(channel, json_msg)
                return True
            except Exception as e:
                print(f"Redis publish failed: {e}. Falling back to local handlers.")
                
        # Fallback to local handlers
        if channel in self.local_handlers:
            for handler in self.local_handlers[channel]:
                try:
                    handler(message)
                except Exception as ex:
                    print(f"Error executing local handler for channel {channel}: {ex}")
        return True

    def subscribe(self, channel: str, callback: Callable[[Dict], None]):
        """Subscribes a callback handler to a channel."""
        if channel not in self.local_handlers:
            self.local_handlers[channel] = []
        self.local_handlers[channel].append(callback)
        
        if self.use_redis and self.redis_client:
            # We maintain a local registry and let the websocket/main process poll Redis pub/sub if needed,
            # but standard callbacks are executed via the local handler routing for simplicity in local dev.
            pass

event_bus = EventBus()
