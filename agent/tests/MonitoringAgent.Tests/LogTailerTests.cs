using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using MonitoringAgent.Worker.Models;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.Tests;

public sealed class LogTailerTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "ma-tests-" + Guid.NewGuid().ToString("N"));

    public LogTailerTests()
    {
        Directory.CreateDirectory(Path.Combine(_dir, "logs"));
    }

    private string LogFile => Path.Combine(_dir, "logs", "app.log");

    private LogTailer NewTailer()
    {
        var tailer = new LogTailer(NullLogger.Instance, Path.Combine(_dir, "offsets.json"));
        tailer.SetSources(new[] { new LogSource { Path = Path.Combine(_dir, "logs", "*.log") } });
        return tailer;
    }

    private void Append(string text) => File.AppendAllText(LogFile, text, new UTF8Encoding(false));

    private static List<LogItem> PollSettled(LogTailer tailer)
    {
        var items = tailer.Poll();
        Thread.Sleep(1600);
        items.AddRange(tailer.Poll());
        return items;
    }

    [Fact]
    public void 켜기_전에_있던_내용은_건너뛰고_새_줄만_읽는다()
    {
        Append("2026-09-14 10:00:00 INFO old line\n");
        var tailer = NewTailer();
        Assert.Empty(tailer.Poll());

        Append("2026-09-14 10:00:01 ERROR payment failed\n2026-09-14 10:00:02 WARN slow query 900ms\n");
        var items = PollSettled(tailer);

        Assert.Equal(2, items.Count);
        Assert.Equal("ERROR", items[0].Level);
        Assert.Equal("payment failed", items[0].Message[(items[0].Message.IndexOf("payment", StringComparison.Ordinal))..]);
        Assert.Equal(new DateTime(2026, 9, 14, 10, 0, 1), items[0].Timestamp.LocalDateTime);
        Assert.Equal("WARN", items[1].Level);
        Assert.EndsWith("app.log", items[1].Source);
    }

    [Fact]
    public void 스택트레이스는_한_건으로_묶는다()
    {
        File.WriteAllText(LogFile, "");
        var tailer = NewTailer();
        tailer.Poll();

        Append("2026-09-14 10:00:01 ERROR java.lang.NullPointerException\n\tat com.demo.OrderService.pay(OrderService.java:42)\n\tat com.demo.Api.run(Api.java:10)\nCaused by: java.io.IOException\n2026-09-14 10:00:02 INFO next\n");
        var items = PollSettled(tailer);

        Assert.Equal(2, items.Count);
        Assert.Contains("OrderService.java:42", items[0].Message);
        Assert.Contains("Caused by", items[0].Message);
        Assert.Equal("INFO", items[1].Level);
    }

    [Fact]
    public void 줄이_끝나기_전에는_보내지_않는다()
    {
        File.WriteAllText(LogFile, "");
        var tailer = NewTailer();
        tailer.Poll();

        Append("2026-09-14 10:00:01 ERROR half");
        Assert.Empty(PollSettled(tailer));

        Append(" line done\n");
        var items = PollSettled(tailer);
        Assert.Single(items);
        Assert.EndsWith("half line done", items[0].Message);
    }

    [Fact]
    public void 파일이_잘리면_처음부터_다시_읽는다()
    {
        File.WriteAllText(LogFile, "");
        var tailer = NewTailer();
        tailer.Poll();
        Append("2026-09-14 10:00:01 INFO first run with a long line to make the file bigger\n");
        PollSettled(tailer);

        File.WriteAllText(LogFile, "2026-09-14 11:00:00 ERROR rotated\n");
        var items = PollSettled(tailer);
        Assert.Single(items);
        Assert.Equal("ERROR", items[0].Level);
    }

    [Fact]
    public void 켜진_뒤_새로_생긴_파일은_처음부터_읽는다()
    {
        var tailer = NewTailer();
        tailer.Poll();

        File.WriteAllText(Path.Combine(_dir, "logs", "new.log"), "2026-09-14 10:00:00 FATAL out of memory\n");
        var items = PollSettled(tailer);
        Assert.Single(items);
        Assert.Equal("FATAL", items[0].Level);
    }

    [Fact]
    public void 저장한_위치부터_이어서_읽는다()
    {
        File.WriteAllText(LogFile, "");
        var first = NewTailer();
        first.Poll();
        Append("2026-09-14 10:00:01 INFO a\n");
        Assert.Single(PollSettled(first));
        first.Commit();

        Append("2026-09-14 10:00:02 INFO b\n");
        var second = NewTailer();
        var items = PollSettled(second);
        Assert.Single(items);
        Assert.EndsWith(" b", items[0].Message);
    }

    [Fact]
    public void JSON_로그의_필드를_읽는다()
    {
        File.WriteAllText(LogFile, "");
        var tailer = NewTailer();
        tailer.Poll();
        Append("{\"@timestamp\":\"2026-09-14T10:00:00+09:00\",\"level\":\"warning\",\"message\":\"disk almost full\"}\n");
        var items = PollSettled(tailer);
        Assert.Single(items);
        Assert.Equal("WARN", items[0].Level);
        Assert.Equal("disk almost full", items[0].Message);
    }

    public void Dispose()
    {
        try { Directory.Delete(_dir, recursive: true); }
        catch { }
    }
}
