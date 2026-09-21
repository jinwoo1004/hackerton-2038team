using System.Text.Json;

namespace MonitoringAgent.Worker.Services;

public sealed class StatusSnapshot
{
    public string Mode { get; set; } = "service";
    public int ProcessId { get; set; }
    public bool Configured { get; set; }
    public string? Server { get; set; }
    public string? ProjectName { get; set; }
    public string? ProjectCode { get; set; }
    public string? AgentName { get; set; }
    public bool? ServerReachable { get; set; }
    public ServerReason LastReason { get; set; } = ServerReason.Ok;
    public string? LastMessage { get; set; }
    public DateTimeOffset? LastHeartbeat { get; set; }
    public DateTimeOffset? LastLogSent { get; set; }
    public DateTimeOffset? LastMetricSent { get; set; }
    public long LogsSent { get; set; }
    public int WatchedFiles { get; set; }
    public int LogSources { get; set; }
    public int Spooled { get; set; }
    public double? CpuPct { get; set; }
    public double? MemoryPct { get; set; }
    public double? DiskPct { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public StatusSnapshot Clone() => (StatusSnapshot)MemberwiseClone();
}

public static class AgentStatus
{
    private static readonly object Gate = new();
    private static StatusSnapshot _current = new();
    private static DateTime _lastWrite = DateTime.MinValue;
    private static int _pending;

    public static event Action? Changed;

    public static StatusSnapshot Current
    {
        get { lock (Gate) { return _current.Clone(); } }
    }

    public static void Update(Action<StatusSnapshot> change)
    {
        StatusSnapshot copy;
        lock (Gate)
        {
            change(_current);
            _current.ProcessId = Environment.ProcessId;
            _current.UpdatedAt = DateTimeOffset.Now;
            copy = _current.Clone();
        }
        Persist(copy);
        try { Changed?.Invoke(); } catch { }
    }

    public static void MarkResult(ApiResult result)
    {
        Update(s =>
        {
            if (result.Reason == ServerReason.Canceled)
            {
                return;
            }
            s.ServerReachable = result.Ok;
            s.LastReason = result.Reason;
            s.LastMessage = result.Ok ? null : result.Message;
        });
    }

    private static void Persist(StatusSnapshot snapshot)
    {
        if ((DateTime.UtcNow - _lastWrite).TotalMilliseconds < 500)
        {
            if (Interlocked.Exchange(ref _pending, 1) == 0)
            {
                Task.Delay(600).ContinueWith(_ =>
                {
                    Interlocked.Exchange(ref _pending, 0);
                    Write(Current);
                });
            }
            return;
        }
        Write(snapshot);
    }

    private static void Write(StatusSnapshot snapshot)
    {
        _lastWrite = DateTime.UtcNow;
        try
        {
            AgentPaths.EnsureDir(AgentPaths.DataDir);
            var temp = AgentPaths.StatusFile + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(snapshot, AgentJson.Options));
            File.Move(temp, AgentPaths.StatusFile, overwrite: true);
        }
        catch { }
    }

    public static StatusSnapshot? ReadFile()
    {
        try
        {
            if (!File.Exists(AgentPaths.StatusFile))
            {
                return null;
            }
            return JsonSerializer.Deserialize<StatusSnapshot>(File.ReadAllText(AgentPaths.StatusFile), AgentJson.Options);
        }
        catch
        {
            return null;
        }
    }
}
