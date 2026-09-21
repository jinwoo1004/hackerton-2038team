import com.fasterxml.jackson.databind.ObjectMapper;
import com.xisnd.monitoring.llm.OpenAiClient;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Independent local transport-failure verification, never a live OpenAI test. */
class LlmBoundaryVerification {
    public static void main(String[] args) throws Exception {
        var mapper = new ObjectMapper();
        for (String scenario : new String[]{"http503", "malformed-json", "timeout"}) {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/responses", exchange -> {
                try {
                    if (scenario.equals("timeout")) Thread.sleep(2500);
                    byte[] body = "invalid-json".getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(scenario.equals("http503") ? 503 : 200, body.length);
                    exchange.getResponseBody().write(body);
                } catch (Exception ignored) { } finally { exchange.close(); }
            });
            server.start();
            try {
                var client = new OpenAiClient(mapper, "synthetic-contract-placeholder", "http://127.0.0.1:" + server.getAddress().getPort(), "verification", 1);
                long start=System.nanoTime();
                var result=client.generate("verification", "Return structured synthetic input", Map.of("synthetic",true), OpenAiClient.objectSchema(Map.of()));
                long ms=(System.nanoTime()-start)/1_000_000;
                if(result.isPresent() || ms>=10000 || (scenario.equals("timeout") && ms<800)) throw new AssertionError(scenario+" failure boundary incorrect");
                System.out.println("PASS " + scenario + " returns empty fallback boundary in " + ms + "ms");
            } finally {server.stop(0);}
        }
    }
}
