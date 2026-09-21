using Microsoft.Extensions.Logging;
using MonitoringAgent.Worker.Models;

namespace MonitoringAgent.Worker.Services;

public sealed class CollectorScheduler : IDisposable
{
    private readonly ILogger _logger;
    private readonly AgentConfigStore _store;
    private readonly SystemMetricsCollector _metrics = new();
    private readonly LogTailer _tailer;
    private readonly SpoolBuffer _spool;
    private readonly IngestApiClient _api;
    private readonly List<LogItem> _pendingLogs = new();
    private readonly SemaphoreSlim _sendGate = new(1, 1);
    private readonly SemaphoreSlim _logGate = new(1, 1);
    private AgentOptions _options;
    private DateTime _lastLogFlush = DateTime.UtcNow;

    public CollectorScheduler(ILogger logger, AgentConfigStore store, string mode)
    {
        _logger = logger;
        _store = store;
        _options = store.Load();
        _tailer = new LogTailer(logger);
        _tailer.SetSources(_options.Logs);
        _spool = new SpoolBuffer(logger, () => _options.SpoolMaxMb * 1024L * 1024L);
        _api = new IngestApiClient(() => _options, logger, maxAttempts: 2);
        AgentStatus.Update(s =>
        {
            s.Mode = mode;
            s.Configured = _options.IsConfigured;
            s.Server = _options.ServerBase;
            s.LogSources = _options.Logs.Count;
        });
    }

    public async Task RunAsync(CancellationToken ct)
    {
        _logger.LogInformation("Monitoring Agent 시작 (버전 {Version})", IngestApiClient.AgentVersion);

        while (!_options.IsConfigured && !ct.IsCancellationRequested)
        {
            _logger.LogWarning("서버 주소와 토큰이 설정되지 않았습니다. {Path} 를 확인해주세요.", _store.Path);
            AgentStatus.Update(s => { s.Configured = false; s.ServerReachable = null; s.LastReason = ServerReason.NotConfigured; });
            try { await Task.Delay(TimeSpan.FromSeconds(10), ct); }
            catch (OperationCanceledException) { return; }
            ReloadIfChanged();
        }

        await SafeAsync("heartbeat", () => HeartbeatAsync(ct));
        await Task.WhenAll(
            LoopAsync("heartbeat", () => TimeSpan.FromSeconds(_options.HeartbeatIntervalSeconds), () => HeartbeatAsync(ct), ct),
            LoopAsync("metrics", () => TimeSpan.FromSeconds(_options.MetricsIntervalSeconds), () => MetricsAsync(ct), ct),
            LoopAsync("logs", () => TimeSpan.FromSeconds(1), () => LogsAsync(false, ct), ct),
            LoopAsync("requests", () => TimeSpan.FromSeconds(2), () => RequestsAsync(ct), ct));

        await SafeAsync("logs", () => LogsAsync(true, CancellationToken.None));
        _logger.LogInformation("Monitoring Agent 종료");
    }

    public async Task RunOnceAsync(CancellationToken ct)
    {
        ReloadIfChanged();
        await SafeAsync("heartbeat", () => HeartbeatAsync(ct));
        await SafeAsync("metrics", () => MetricsAsync(ct));
        await SafeAsync("logs", () => LogsAsync(true, ct));
    }

    private async Task HeartbeatAsync(CancellationToken ct)
    {
        ReloadIfChanged();
        var (result, body) = await _api.HeartbeatAsync(HostInfo.Heartbeat(), ct);
        AgentStatus.MarkResult(result);
        if (result.Ok)
        {
            AgentStatus.Update(s =>
            {
                s.LastHeartbeat = DateTimeOffset.Now;
                s.ProjectName = body?.ProjectName;
                s.ProjectCode = body?.ProjectCode;
                s.AgentName = body?.AgentName;
            });
            if (_spool.Count > 0)
            {
                await _sendGate.WaitAsync(ct);
                try { await _spool.DrainAsync(_api, ct); }
                finally { _sendGate.Release(); }
            }
        }
        AgentStatus.Update(s => s.Spooled = _spool.Count);
    }

    private async Task MetricsAsync(CancellationToken ct)
    {
        var point = _metrics.Collect();
        AgentStatus.Update(s =>
        {
            s.CpuPct = point.CpuPct;
            s.MemoryPct = point.MemoryPct;
            s.DiskPct = point.DiskPct;
        });
        await SendAsync("/api/ingest/metrics", IngestApiClient.Serialize(new MetricBatch { Points = { point } }), ct,
            () => AgentStatus.Update(s => s.LastMetricSent = DateTimeOffset.Now));
    }

    private async Task LogsAsync(bool force, CancellationToken ct)
    {
        await _logGate.WaitAsync(ct);
        try
        {
            await CollectLogsAsync(force, ct);
        }
        finally
        {
            _logGate.Release();
        }
    }

    private async Task CollectLogsAsync(bool force, CancellationToken ct)
    {
        _pendingLogs.AddRange(_tailer.Poll());
        AgentStatus.Update(s => s.WatchedFiles = _tailer.WatchedFiles);
        var due = DateTime.UtcNow - _lastLogFlush >= TimeSpan.FromSeconds(_options.LogFlushSeconds);
        if (_pendingLogs.Count == 0 || (!force && !due && _pendingLogs.Count < _options.LogBatchSize))
        {
            _tailer.Commit();
            return;
        }

        _lastLogFlush = DateTime.UtcNow;
        var batches = _pendingLogs.Chunk(_options.LogBatchSize).Select(c => c.ToList()).ToList();
        _pendingLogs.Clear();
        foreach (var batch in batches)
        {
            var count = batch.Count;
            await SendAsync("/api/ingest/logs", IngestApiClient.Serialize(new LogBatch { Entries = batch }), ct,
                () => AgentStatus.Update(s =>
                {
                    s.LastLogSent = DateTimeOffset.Now;
                    s.LogsSent += count;
                }));
        }
        _tailer.Commit();
    }

    private async Task SendAsync(string path, byte[] body, CancellationToken ct, Action onSent)
    {
        // 서버가 끊긴 동안은 바로 보관하고, 다시 연결되면 heartbeat 에서 몰아서 보낸다
        if (IsOffline())
        {
            _spool.Save(path, body);
            AgentStatus.Update(s => s.Spooled = _spool.Count);
            return;
        }
        await _sendGate.WaitAsync(ct);
        try
        {
            var result = await _api.SendRawAsync(path, body, ct);
            AgentStatus.MarkResult(result);
            if (result.Ok)
            {
                onSent();
                return;
            }
            if (result.Reason is ServerReason.Canceled or ServerReason.BadResponse or ServerReason.TooLarge)
            {
                return;
            }
            _spool.Save(path, body);
            AgentStatus.Update(s => s.Spooled = _spool.Count);
        }
        finally
        {
            _sendGate.Release();
        }
    }

    private static bool IsOffline()
    {
        var s = AgentStatus.Current;
        return s.ServerReachable == false
            && s.LastReason is ServerReason.Unreachable or ServerReason.Timeout or ServerReason.ServerError;
    }

    private async Task RequestsAsync(CancellationToken ct)
    {
        if (!File.Exists(AgentPaths.SyncRequestFile))
        {
            return;
        }
        try { File.Delete(AgentPaths.SyncRequestFile); }
        catch { return; }
        _logger.LogInformation("트레이에서 지금 보내기를 요청했습니다.");
        await RunOnceAsync(ct);
    }

    private void ReloadIfChanged()
    {
        if (!_store.HasChanged())
        {
            return;
        }
        _options = _store.Load();
        _tailer.SetSources(_options.Logs);
        _logger.LogInformation("설정을 다시 읽었습니다. 로그 경로 {Count}개", _options.Logs.Count);
        AgentStatus.Update(s =>
        {
            s.Configured = _options.IsConfigured;
            s.Server = _options.ServerBase;
            s.LogSources = _options.Logs.Count;
        });
    }

    private async Task LoopAsync(string step, Func<TimeSpan> interval, Func<Task> action, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(interval(), ct); }
            catch (OperationCanceledException) { return; }
            await SafeAsync(step, action);
        }
    }

    private async Task SafeAsync(string step, Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{Step} 처리 중 오류", step);
        }
    }

    public void Dispose()
    {
        _api.Dispose();
        _sendGate.Dispose();
        _logGate.Dispose();
    }
}
