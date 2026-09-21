using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MonitoringAgent.Worker;
using MonitoringAgent.Worker.Services;
using Serilog;

var exeDir = AppContext.BaseDirectory;
Directory.SetCurrentDirectory(exeDir);

var dataDir = args.SkipWhile(a => a != "--data-dir").Skip(1).FirstOrDefault();
if (!string.IsNullOrWhiteSpace(dataDir))
{
    AgentPaths.DataDir = Path.GetFullPath(dataDir);
}
AgentPaths.EnsureDir(AgentPaths.LogDir);

const string Template = "[{Timestamp:yyyy-MM-dd HH:mm:ss}] [{Level:u3}] {Message:lj}{NewLine}{Exception}";

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: Template)
    .WriteTo.File(Path.Combine(AgentPaths.LogDir, "bootstrap-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
    .CreateBootstrapLogger();

try
{
    var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
    {
        Args = args,
        ContentRootPath = exeDir,
    });

    builder.Services.AddWindowsService(options => options.ServiceName = "MonitoringAgentService");
    builder.Services.AddSerilog((services, lc) => lc
        .ReadFrom.Configuration(builder.Configuration)
        .ReadFrom.Services(services)
        .WriteTo.Console(outputTemplate: Template)
        .WriteTo.File(Path.Combine(AgentPaths.LogDir, "agent-.log"),
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 31,
            flushToDiskInterval: TimeSpan.FromSeconds(1),
            outputTemplate: Template));
    builder.Services.AddHostedService<Worker>();

    builder.Build().Run();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Monitoring Agent 가 비정상 종료되었습니다.");
    return 1;
}
finally
{
    Log.CloseAndFlush();
}
