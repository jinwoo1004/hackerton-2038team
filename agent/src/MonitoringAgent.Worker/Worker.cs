using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.Worker;

public sealed class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;

    public Worker(ILogger<Worker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        IDisposable? guard = null;
        while (!stoppingToken.IsCancellationRequested && (guard = SingleInstanceGuard.TryAcquire()) is null)
        {
            _logger.LogWarning("다른 수집 프로세스가 실행 중이라 끝나기를 기다립니다.");
            try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
            catch (OperationCanceledException) { return; }
        }

        using (guard)
        using (var scheduler = new CollectorScheduler(_logger, new AgentConfigStore(), "service"))
        {
            await scheduler.RunAsync(stoppingToken);
        }
    }
}
