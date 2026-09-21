using Microsoft.Extensions.Logging.Abstractions;
using MonitoringAgent.Worker.Models;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.Tests;

public class ParserAndConfigTests
{
    [Theory]
    [InlineData("2026-09-14 10:00:00.123 ERROR [main] boom", "ERROR")]
    [InlineData("2026-09-14T10:00:00Z WARNING cache miss", "WARN")]
    [InlineData("2026/09/14 10:00:00 [error] 1234#0: upstream timed out", "ERROR")]
    [InlineData("SEVERE: Servlet failed", "ERROR")]
    [InlineData("CRITICAL database down", "FATAL")]
    [InlineData("user logged in", "UNKNOWN")]
    public void 로그_레벨을_읽는다(string line, string expected)
    {
        Assert.Equal(expected, LogLineParser.ParseLevel(line));
    }

    [Fact]
    public void 줄_앞의_시각을_읽는다()
    {
        var ts = LogLineParser.ParseTimestamp("[2026-09-14 10:11:12,345] INFO started");
        Assert.NotNull(ts);
        Assert.Equal(new DateTime(2026, 9, 14, 10, 11, 12, 345), ts!.Value.LocalDateTime);
        Assert.Null(LogLineParser.ParseTimestamp("no time here"));
    }

    [Theory]
    [InlineData("\tat com.demo.A.b(A.java:1)", true)]
    [InlineData("   at System.Foo()", true)]
    [InlineData("Caused by: x", true)]
    [InlineData("2026-09-14 10:00:00 INFO next", false)]
    public void 이어지는_줄을_구분한다(string line, bool expected)
    {
        Assert.Equal(expected, LogLineParser.IsContinuation(line));
    }

    [Fact]
    public void 설정_파일을_정리해서_저장하고_읽는다()
    {
        var path = Path.Combine(Path.GetTempPath(), "ma-config-" + Guid.NewGuid().ToString("N") + ".json");
        try
        {
            AgentConfigStore.Save(path, new AgentOptions
            {
                Server = " http://localhost:8080/ ",
                Token = " agt_abc ",
                Logs = { new LogSource { Path = @"C:\logs\*.log" }, new LogSource { Path = @"c:\LOGS\*.log" }, new LogSource { Path = " " } },
                MetricsIntervalSeconds = 1,
            });
            var text = File.ReadAllText(path);
            Assert.Contains("\"server\"", text);
            Assert.Contains("\"metricsIntervalSeconds\": 5", text);

            var store = new AgentConfigStore(path);
            var loaded = store.Load();
            Assert.Equal("http://localhost:8080", loaded.ServerBase);
            Assert.Equal("agt_abc", loaded.Token);
            Assert.Single(loaded.Logs);
            Assert.True(loaded.IsConfigured);
            Assert.False(store.HasChanged());
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void 보관_한도를_넘으면_오래된_묶음부터_지운다()
    {
        var dir = Path.Combine(Path.GetTempPath(), "ma-spool-" + Guid.NewGuid().ToString("N"));
        try
        {
            var spool = new SpoolBuffer(NullLogger.Instance, () => 2500, dir);
            for (var i = 0; i < 5; i++)
            {
                spool.Save("/api/ingest/logs", new byte[1000]);
                Thread.Sleep(5);
            }
            Assert.Equal(2, spool.Count);
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void 서버_자원을_측정한다()
    {
        var collector = new SystemMetricsCollector();
        Thread.Sleep(300);
        var point = collector.Collect();
        Assert.InRange(point.MemoryPct ?? -1, 0, 100);
        Assert.InRange(point.DiskPct ?? -1, 0, 100);
        Assert.True(point.MemoryTotalMb > 0);
    }
}
