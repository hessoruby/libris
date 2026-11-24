import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** In-memory sessions for the local demo. Expiry is enforced on the server. */
final class SessionStore
{
        private final Map<String, Instant> sessions = new HashMap<>();
        private final Clock clock;
        private final Duration lifetime;

        SessionStore(Clock clock, Duration lifetime)
        {
                if (lifetime.isNegative() || lifetime.isZero())
                        throw new IllegalArgumentException("Session lifetime must be positive.");
                this.clock = clock;
                this.lifetime = lifetime;
        }

        synchronized String create()
        {
                Instant now = clock.instant();
                sessions.values().removeIf(expiry -> !expiry.isAfter(now));
                String id = UUID.randomUUID().toString();
                sessions.put(id, now.plus(lifetime));
                return id;
        }

        synchronized boolean contains(String id)
        {
                Instant expiry = sessions.get(id);
                if (expiry == null)
                        return false;
                if (!expiry.isAfter(clock.instant()))
                {
                        sessions.remove(id);
                        return false;
                }
                return true;
        }

        synchronized void remove(String id)
        {       sessions.remove(id); }
}
