using System.IO;
using Microsoft.Extensions.Logging;
using MonitoringAgent.Worker.Services;
using Serilog;
using Serilog.Extensions.Logging;

namespace MonitoringAgent.App;

public static class BackgroundAgent
{
    public static CollectorScheduler? Current { get; private set; }

    public static CancellationToken Token { get; private set; }

    public static async Task RunAsync(CancellationToken ct)
    {
        Token = ct;
        AgentPaths.EnsureDir(AgentPaths.LogDir);
        var serilog = new LoggerConfiguration()
            .WriteTo.File(
                Path.Combine(AgentPaths.LogDir, "background-.log"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 31,
                flushToDiskInterval: TimeSpan.FromSeconds(1),
                outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss}] [{Level:u3}] {Message:lj}{NewLine}{Exception}")
            .CreateLogger();
        var factory = new SerilogLoggerFactory(serilog);

        try
        {
            using var scheduler = new CollectorScheduler(factory.CreateLogger("MonitoringAgent.Background"), new AgentConfigStore(), "background");
            Current = scheduler;
            await scheduler.RunAsync(ct);
        }
        catch (OperationCanceledException) { }
        finally
        {
            Current = null;
            await serilog.DisposeAsync();
        }
    }
}
