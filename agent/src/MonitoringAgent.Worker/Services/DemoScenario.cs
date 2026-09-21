using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public sealed record DemoSample(MetricItem Metric, IReadOnlyList<LogItem> Logs);

/// <summary>Repeatable, synthetic-only samples. No machine metrics or attached production logs are read.</summary>
public static class DemoScenario
{
    public static DemoSample At(DateTimeOffset anchor, int tick)
    {
        if (tick < 0) throw new ArgumentOutOfRangeException(nameof(tick));
        var timestamp = anchor.AddSeconds(tick * 5);
        var phase = tick % 60;
        // Keep these formulas in sync with demo-fixtures/scenario.json and the browser/backend seed.
        var cpu = 28.0 + phase * 7 % 13;
        var memory = 54.0 + phase * 3 % 9;
        var disk = 42.0 + phase * 0.05;
        const int latency = 120;
        return new DemoSample(new MetricItem
        {
            Timestamp = timestamp, CpuPct = cpu, MemoryPct = memory, DiskPct = disk,
            MemoryTotalMb = 8192, MemoryUsedMb = Math.Round(8192 * memory / 100, 2),
            DiskTotalGb = 256, DiskUsedGb = Math.Round(256 * disk / 100, 2),
            NetInKbps = 180 + phase * 7, NetOutKbps = 90 + phase * 5,
        }, new[]
        {
            new LogItem { Timestamp = timestamp, Level = "INFO", Source = "synthetic-wallpad.log",
                Message = $"[SYNTHETIC] wallpad request server=wallpad-demo-01 command=STATUS responseMs={latency} status=200 sequence={tick:D6}" },
        });
    }

    public static bool IsSafeServer(string server) =>
        Uri.TryCreate(server, UriKind.Absolute, out var uri) && uri.IsLoopback &&
        (uri.Scheme == "http" || uri.Scheme == "https");
}
