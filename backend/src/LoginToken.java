import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

class LoginToken
{
        static boolean enabled()
        {       return System.getenv("SESSION_SECRET") != null; }

        static String create() throws Exception
        {
                String value = UUID.randomUUID() + "." + (System.currentTimeMillis() + 28800000);
                return value + "." + sign(value);
        }

        static boolean valid(String token) throws Exception
        {
                if (token == null || token.length() > 512)
                        return false;
                String[] parts = token.split("\\.", -1);
                if (parts.length != 3)
                        return false;
                try
                {
                        if (Long.parseLong(parts[1]) <= System.currentTimeMillis())
                                return false;
                }
                catch (NumberFormatException e)
                {       return false; }
                String expected = sign(parts[0] + "." + parts[1]);
                return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8));
        }

        private static String sign(String value) throws Exception
        {
                String secret = System.getenv("SESSION_SECRET");
                if (secret == null || secret.length() < 32)
                        throw new IllegalStateException("SESSION_SECRET must have at least 32 characters.");
                Mac mac = Mac.getInstance("HmacSHA256");
                mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
                return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        }
}
