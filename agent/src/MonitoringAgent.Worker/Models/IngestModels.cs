namespace MonitoringAgent.Worker.Models;

public sealed class HeartbeatPayload
{
    public string? Hostname { get; set; }
    public string? Os { get; set; }
    public string? AgentVersion { get; set; }
    public string? IpAddress { get; set; }
}

public sealed class HeartbeatResponse
{
    public long AgentId { get; set; }
    public string? AgentName { get; set; }
    public long ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public string? ProjectCode { get; set; }
}

public sealed class LogItem
{
    public DateTimeOffset Timestamp { get; set; }
    public string Level { get; set; } = "UNKNOWN";
    public string? Source { get; set; }
    public string Message { get; set; } = string.Empty;
}

public sealed class LogBatch
{
    public List<LogItem> Entries { get; set; } = new();
}

public sealed class MetricItem
{
    public DateTimeOffset Timestamp { get; set; }
    public double? CpuPct { get; set; }
    public double? MemoryPct { get; set; }
    public double? MemoryUsedMb { get; set; }
    public double? MemoryTotalMb { get; set; }
    public double? DiskPct { get; set; }
    public double? DiskUsedGb { get; set; }
    public double? DiskTotalGb { get; set; }
    public double? NetInKbps { get; set; }
    public double? NetOutKbps { get; set; }
}

public sealed class MetricBatch
{
    public List<MetricItem> Points { get; set; } = new();
}
