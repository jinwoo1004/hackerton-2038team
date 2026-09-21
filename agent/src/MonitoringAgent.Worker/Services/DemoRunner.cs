using Microsoft.Extensions.Logging.Abstractions;
using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public static class DemoRunner
{
    public static async Task<int> RunAsync(string[] args)
    {
        var server = Environment.GetEnvironmentVariable("MONITORING_DEMO_SERVER") ?? "http://127.0.0.1:8080";
        var token = Environment.GetEnvironmentVariable("MONITORING_DEMO_AGENT_TOKEN") ?? "";
        if (!DemoScenario.IsSafeServer(server) || string.IsNullOrWhiteSpace(token))
        {
            Console.Error.WriteLine("Demo requires a loopback server and MONITORING_DEMO_AGENT_TOKEN in the environment.");
            return 2;
        }
        var cyclesValue = args.SkipWhile(a => a != "--demo-cycles").Skip(1).FirstOrDefault();
        var cycles = int.TryParse(cyclesValue, out var value) ? value : 0;
        if (cycles < 0) return 2;
        using var cancellation = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
        var options = new AgentOptions { Server = server, Token = token, TimeoutSeconds = 4 };
        using var api = new IngestApiClient(() => options, NullLogger.Instance, maxAttempts: 1);
        var anchor = DateTimeOffset.UtcNow;
        var tick = 0;
        Console.WriteLine("Synthetic demo agent started; no host metrics or real logs are collected.");
        try
        {
            while (!cancellation.IsCancellationRequested && (cycles == 0 || tick < cycles))
            {
                var heartbeat = await api.HeartbeatAsync(new HeartbeatPayload
                { Hostname = "wallpad-demo-01", Os = "Windows (synthetic demo)", AgentVersion = "1.0.0-demo", IpAddress = "127.0.0.1" }, cancellation.Token);
                var sample = DemoScenario.At(anchor, tick);
                var metrics = await api.SendMetricsAsync(new[] { sample.Metric }, cancellation.Token);
                var logs = await api.SendLogsAsync(sample.Logs, cancellation.Token);
                if (!heartbeat.Result.Ok || !metrics.Ok || !logs.Ok)
                {
                    // Never print request headers, server response bodies, or tokens.
                    Console.Error.WriteLine($"Synthetic send failed: heartbeat={heartbeat.Result.Status}, metrics={metrics.Status}, logs={logs.Status}");
                    if (cycles > 0) return 1;
                }
                else Console.WriteLine($"Synthetic sample sent: sequence={tick:D6}, metrics=1, logs={sample.Logs.Count}");
                tick++;
                if (cycles == 0 || tick < cycles) await Task.Delay(TimeSpan.FromSeconds(5), cancellation.Token);
            }
        }
        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
        return 0;
    }
}
