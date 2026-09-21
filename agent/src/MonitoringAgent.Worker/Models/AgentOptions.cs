namespace MonitoringAgent.Worker.Models;

public sealed class AgentOptions
{
    public string Server { get; set; } = string.Empty;

    public string Token { get; set; } = string.Empty;

    public List<LogSource> Logs { get; set; } = new();

    public int MetricsIntervalSeconds { get; set; } = 15;

    public int HeartbeatIntervalSeconds { get; set; } = 30;

    public int LogFlushSeconds { get; set; } = 5;

    public int LogBatchSize { get; set; } = 500;

    public int SpoolMaxMb { get; set; } = 50;

    public int TimeoutSeconds { get; set; } = 15;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Server) && !string.IsNullOrWhiteSpace(Token);

    public string ServerBase => Server.Trim().TrimEnd('/');
}

public sealed class LogSource
{
    public string Path { get; set; } = string.Empty;
}
