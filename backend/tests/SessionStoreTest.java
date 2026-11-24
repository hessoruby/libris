import java.time.*;

public class SessionStoreTest
{
        private static final class MutableClock extends Clock
        {
                Instant now = Instant.parse("2026-01-01T00:00:00Z");
                public ZoneId getZone() { return ZoneOffset.UTC; }
                public Clock withZone(ZoneId zone) { return this; }
                public Instant instant() { return now; }
        }

        public static void main(String[] args)
        {
                MutableClock clock = new MutableClock();
                SessionStore store = new SessionStore(clock, Duration.ofHours(8));
                check(!store.contains(null) && !store.contains("unknown"), "Unknown sessions rejected");
                String first = store.create();
                String second = store.create();
                check(!first.equals(second), "Sessions are unique");
                check(store.contains(first), "New session works");
                store.remove(first);
                check(!store.contains(first) && store.contains(second), "Logout affects only its session");
                clock.now = clock.now.plus(Duration.ofHours(8)).minusSeconds(1);
                check(store.contains(second), "Valid before expiry");
                clock.now = clock.now.plusSeconds(1);
                check(!store.contains(second), "Rejected at expiry");
                check(store.contains(store.create()), "New login works after expiry");
                System.out.println("SessionStore: 7 checks passed");
        }

        private static void check(boolean condition, String message)
        {
                if (!condition) throw new AssertionError(message);
        }
}
