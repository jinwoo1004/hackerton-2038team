using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.Tests;

public class DemoScenarioTests
{
    [Fact]
    public void SeedProducesRepeatableTimedSyntheticPayloads()
    {
        var anchor = DateTimeOffset.Parse("2026-09-21T00:00:00Z");
        var first = DemoScenario.At(anchor, 7);
        var second = DemoScenario.At(anchor, 7);
        Assert.Equal(IngestApiClient.Serialize(first.Metric), IngestApiClient.Serialize(second.Metric));
        Assert.Equal(IngestApiClient.Serialize(first.Logs), IngestApiClient.Serialize(second.Logs));
        Assert.Equal(anchor.AddSeconds(35), first.Metric.Timestamp);
        Assert.InRange(first.Metric.CpuPct!.Value, 0, 100);
        Assert.InRange(first.Metric.MemoryPct!.Value, 0, 100);
        Assert.InRange(first.Metric.DiskPct!.Value, 0, 100);
        Assert.All(first.Logs, log => Assert.StartsWith("[SYNTHETIC]", log.Message));
        Assert.NotEqual(first.Metric.CpuPct, DemoScenario.At(anchor, 8).Metric.CpuPct);
    }

    [Theory]
    [InlineData("http://127.0.0.1:8080", true)]
    [InlineData("http://localhost:8080", true)]
    [InlineData("https://example.com", false)]
    [InlineData("file:///c:/logs", false)]
    [InlineData("invalid", false)]
    public void SyntheticSenderIsRestrictedToLoopback(string url, bool allowed) =>
        Assert.Equal(allowed, DemoScenario.IsSafeServer(url));
}
